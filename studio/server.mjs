/**
 * 로컬 전용 편집 API.
 *
 * 이 코드는 Astro 빌드에 포함되지 않습니다 — 별도 Vite 앱(`npm run studio`)으로만
 * 돌아가므로, 공개된 사이트에는 편집 기능이 존재하지 않습니다.
 * 그래서 로그인·인증을 만들 필요가 없습니다.
 */
import { readFile, writeFile, readdir, mkdir, rename, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import sharp from 'sharp';
import {
  listAll as listAllComments,
  listPending as listPendingComments,
  setApproved as setCommentApproved,
  removeComment,
  setPinned as setCommentPinned,
  listPublished as listPublishedComments,
  safeSlug as safeCommentSlug,
} from '../scripts/comments-store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const POSTS_DIR = path.join(ROOT, 'content/posts');
const IMAGES_DIR = path.join(ROOT, 'public/images/posts');
const TRASH_DIR = path.join(ROOT, 'content/.trash');
const IMAGES_ROOT = path.join(ROOT, 'public/images');

const MIME = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};
const ICONS_JSON = path.join(ROOT, 'node_modules/@iconify-json/fa6-solid/icons.json');

/** 사진 가로 상한. 본문 폭보다 넉넉하되 용량이 커지지 않는 지점. */
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 82;

const json = (res, data, status = 200) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

/** 경로 조작 방지 + 파일명으로 쓸 수 있는 형태로 정리. */
function safeSlug(slug) {
  const s = String(slug ?? '')
    .normalize('NFC') // 한글 자모 정규화를 통일한다
    .trim()
    .replace(/[/\\]/g, '-')
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-') // 공백 → 하이픈
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, ''); // 앞뒤 하이픈·점 정리
  if (!s) throw new Error('slug 가 비어 있습니다.');
  return s;
}

export function adminApi() {
  return {
    name: 'heritage-admin-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const route = url.pathname;
        // 사진(/images/)과 편집 API(/api/)만 여기서 처리한다
        if (!route.startsWith('/api/') && !route.startsWith('/images/')) return next();

        try {
          // ── 사진 서빙 ──────────────────────────────────────
          // macOS 는 한글 파일명을 NFD 로 저장하는데 브라우저는 NFC 로 요청한다.
          // 그대로 두면 올린 사진이 편집기에서 깨진 그림으로 보인다.
          if (route.startsWith('/images/') && req.method === 'GET') {
            const want = decodeURIComponent(route).replace(/^\/images\//, '');
            for (const variant of [want, want.normalize('NFC'), want.normalize('NFD')]) {
              const file = path.join(IMAGES_ROOT, variant);
              if (!file.startsWith(IMAGES_ROOT)) break; // 경로 탈출 차단
              try {
                const st = await stat(file);
                if (!st.isFile()) continue;
                res.setHeader('content-type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
                res.setHeader('content-length', st.size);
                res.setHeader('cache-control', 'no-cache');
                return createReadStream(file).pipe(res);
              } catch {
                /* 다음 표기법으로 */
              }
            }
            return next();
          }

          // ── 글 목록 ────────────────────────────────────────
          if (route === '/api/posts' && req.method === 'GET') {
            await mkdir(POSTS_DIR, { recursive: true });
            const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith('.md'));
            const posts = await Promise.all(
              files.map(async (f) => {
                const raw = await readFile(path.join(POSTS_DIR, f), 'utf8');
                const { data } = matter(raw);
                // js-yaml 이 날짜를 Date 로 파싱하므로 ISO 로 normalize 한다.
                // (그냥 String() 하면 "Wed Oct 28 2026..." 이 되어 정렬이 깨진다)
                const date =
                  data.date instanceof Date
                    ? data.date.toISOString().slice(0, 10)
                    : String(data.date ?? '').slice(0, 10);
                return {
                  slug: f.replace(/\.md$/, ''),
                  title: data.title ?? '(제목 없음)',
                  date,
                  category: data.category ?? '',
                  kind: data.kind ?? '',
                  draft: Boolean(data.draft),
                };
              }),
            );
            posts.sort((a, b) => b.date.localeCompare(a.date));
            return json(res, { posts });
          }

          // ── 글 한 편 읽기 ──────────────────────────────────
          if (route === '/api/post' && req.method === 'GET') {
            const slug = safeSlug(url.searchParams.get('slug'));
            const raw = await readFile(path.join(POSTS_DIR, `${slug}.md`), 'utf8');
            const { data, content } = matter(raw);
            return json(res, { slug, frontmatter: data, body: content });
          }

          // ── 저장 ───────────────────────────────────────────
          if (route === '/api/save' && req.method === 'POST') {
            const { slug: rawSlug, frontmatter, html } = JSON.parse((await readBody(req)).toString('utf8'));
            const slug = safeSlug(rawSlug);
            await mkdir(POSTS_DIR, { recursive: true });
            // gray-matter 가 YAML 프론트매터를 붙여준다.
            const file = matter.stringify(`\n${html.trim()}\n`, frontmatter);
            await writeFile(path.join(POSTS_DIR, `${slug}.md`), file, 'utf8');
            return json(res, { ok: true, slug, path: `content/posts/${slug}.md` });
          }

          // ── 삭제: 지우지 않고 휴지통으로 옮긴다 ────────────
          // 커밋 전 글은 git 으로도 되살릴 수 없으므로 영구 삭제하지 않는다.
          if (route === '/api/delete' && req.method === 'POST') {
            const { slug: rawSlug } = JSON.parse((await readBody(req)).toString('utf8'));
            const slug = safeSlug(rawSlug);
            await mkdir(TRASH_DIR, { recursive: true });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const dest = path.join(TRASH_DIR, `${slug}--${stamp}.md`);
            await rename(path.join(POSTS_DIR, `${slug}.md`), dest);
            return json(res, { ok: true, movedTo: path.relative(ROOT, dest) });
          }

          // ── 사진 업로드: 리사이즈 + webp + EXIF(GPS) 제거 ──
          if (route === '/api/upload' && req.method === 'POST') {
            // HTTP 헤더는 latin-1 이라 한글이 그대로는 깨진다. 양쪽에서 URI 인코딩한다.
            const slug = safeSlug(decodeURIComponent(String(req.headers['x-slug'] ?? '')));
            const original = String(req.headers['x-filename'] ?? 'image');
            const buf = await readBody(req);

            const dir = path.join(IMAGES_DIR, slug);
            await mkdir(dir, { recursive: true });

            const base = path
              .basename(decodeURIComponent(original).normalize('NFC'))
              .replace(/\.[^.]+$/, '')
              .replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '-')
              .slice(0, 60) || 'photo';

            const existing = await readdir(dir).catch(() => []);
            const n = String(existing.filter((f) => f.endsWith('.webp')).length + 1).padStart(2, '0');
            const name = `${n}-${base}.webp`;

            // sharp 는 기본적으로 메타데이터를 버린다 → 촬영 위치(GPS)가 함께 제거된다.
            // 여행 사진을 그대로 올리면 집 근처 좌표까지 노출될 수 있다.
            const out = await sharp(buf)
              .rotate() // EXIF 방향만 반영한 뒤 메타데이터는 버린다
              .resize({ width: MAX_WIDTH, withoutEnlargement: true })
              .webp({ quality: WEBP_QUALITY })
              .toBuffer({ resolveWithObject: true });

            await writeFile(path.join(dir, name), out.data);

            return json(res, {
              ok: true,
              src: `/images/posts/${slug}/${name}`.normalize('NFC'),
              width: out.info.width,
              height: out.info.height,
              bytes: out.info.size,
            });
          }

          // ── 댓글 검토 ──────────────────────────────────────
          // 방문자가 쓴 댓글은 승인하기 전까지 공개 사이트에 보이지 않는다.
          if (route === '/api/comments/pending' && req.method === 'GET') {
            return json(res, { comments: await listPendingComments() });
          }

          if (route === '/api/comments/published' && req.method === 'GET') {
            return json(res, { comments: await listPublishedComments() });
          }

          if (route === '/api/comments/all' && req.method === 'GET') {
            const slug = safeCommentSlug(url.searchParams.get('slug'));
            if (!slug) return json(res, { error: '글을 찾을 수 없습니다.' }, 400);
            return json(res, { comments: await listAllComments(slug) });
          }

          if (route === '/api/comments/moderate' && req.method === 'POST') {
            const { slug: rawSlug, id, action } = JSON.parse((await readBody(req)).toString('utf8'));
            const slug = safeCommentSlug(rawSlug);
            if (!slug || !id) return json(res, { error: '잘못된 요청입니다.' }, 400);

            const result =
              action === 'delete'
                ? await removeComment(slug, id)
                : action === 'pin' || action === 'unpin'
                  ? await setCommentPinned(slug, id, action === 'pin')
                  : await setCommentApproved(slug, id, action === 'approve');

            return json(res, result, result.error ? 400 : 200);
          }

          // ── Font Awesome Free 아이콘 목록 (스티커 대체) ────
          if (route === '/api/icons' && req.method === 'GET') {
            const set = JSON.parse(await readFile(ICONS_JSON, 'utf8'));
            const w = set.width ?? 512;
            const h = set.height ?? 512;
            const icons = Object.entries(set.icons).map(([name, def]) => ({
              name,
              body: def.body,
              viewBox: `0 0 ${def.width ?? w} ${def.height ?? h}`,
            }));
            res.setHeader('cache-control', 'max-age=3600');
            return json(res, { icons });
          }

          return json(res, { error: 'not found' }, 404);
        } catch (err) {
          console.error('[admin api]', err);
          return json(res, { error: String(err?.message ?? err) }, 500);
        }
      });
    },
  };
}
