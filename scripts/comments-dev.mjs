/**
 * 개발 중에만 도는 댓글 API.
 *
 * Astro 개발 서버는 자기가 아는 경로(페이지·에셋)만 Vite 미들웨어로 넘깁니다.
 * 그래서 /api/comments 같은 새 경로는 Vite 플러그인으로는 받을 수 없습니다.
 * 대신 127.0.0.1:4323 에 작은 서버를 따로 띄우고, 개발 중에만 그쪽을 부릅니다.
 *
 * 배포하면 이 자리를 Cloudflare Pages Functions 가 대신합니다 (functions/api/comments.ts).
 * 주고받는 모양이 같으므로 화면 쪽은 주소만 바뀝니다.
 */
import http from 'node:http';
import { addComment, listApproved, safeSlug } from './comments-store.mjs';
import { getLikes, bumpLikes } from './likes-store.mjs';

export const COMMENTS_DEV_PORT = 4323;
export const COMMENTS_DEV_ORIGIN = `http://127.0.0.1:${COMMENTS_DEV_PORT}`;

/** 개발 서버에서만 부르므로 로컬 주소만 허용한다 */
const ALLOWED = new Set(['http://localhost:4321', 'http://127.0.0.1:4321', COMMENTS_DEV_ORIGIN]);

/** IP 하나가 10분에 쓸 수 있는 댓글 수 */
const RATE = { max: 5, windowMs: 10 * 60 * 1000 };
/** 좋아요는 누르고 무르는 게 자연스러우니 조금 넉넉하게 */
const LIKE_RATE = { max: 30, windowMs: 10 * 60 * 1000 };
const hits = new Map();
const likeHits = new Map();

function limited(store, rule, ip) {
  const now = Date.now();
  const list = (store.get(ip) ?? []).filter((t) => now - t < rule.windowMs);
  if (list.length >= rule.max) {
    store.set(ip, list);
    return true;
  }
  list.push(now);
  store.set(ip, list);
  return false;
}

const rateLimited = (ip) => limited(hits, RATE, ip);
const likeLimited = (ip) => limited(likeHits, LIKE_RATE, ip);

function send(res, status, body, origin) {
  if (origin && ALLOWED.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-headers', 'content-type');
    res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  }
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req, limit = 8 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('너무 깁니다.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handle(req, res) {
  const origin = req.headers.origin;
  const url = new URL(req.url ?? '/', COMMENTS_DEV_ORIGIN);

  if (req.method === 'OPTIONS') return send(res, 204, {}, origin);

  const route = url.pathname.replace(/\/$/, '');

  // ── 좋아요 ────────────────────────────────────────
  if (route === '/api/likes') {
    const slug = safeSlug(url.searchParams.get('slug'));
    if (req.method === 'GET') {
      if (!slug) return send(res, 400, { error: '글을 찾을 수 없습니다.' }, origin);
      return send(res, 200, { likes: await getLikes(slug) }, origin);
    }
    if (req.method === 'POST') {
      const ip = req.socket.remoteAddress ?? 'unknown';
      if (likeLimited(ip)) return send(res, 429, { error: '잠시 후에 다시 시도해주세요.' }, origin);
      const payload = JSON.parse(await readBody(req));
      const s = safeSlug(payload.slug);
      if (!s) return send(res, 400, { error: '글을 찾을 수 없습니다.' }, origin);
      const likes = await bumpLikes(s, payload.liked ? 1 : -1);
      return send(res, 200, { likes }, origin);
    }
    return send(res, 405, { error: 'method not allowed' }, origin);
  }

  if (route !== '/api/comments') {
    return send(res, 404, { error: 'not found' }, origin);
  }

  if (req.method === 'GET') {
    const slug = safeSlug(url.searchParams.get('slug'));
    if (!slug) return send(res, 400, { error: '글을 찾을 수 없습니다.' }, origin);
    return send(res, 200, { comments: await listApproved(slug) }, origin);
  }

  if (req.method === 'POST') {
    const ip = req.socket.remoteAddress ?? 'unknown';
    if (rateLimited(ip)) return send(res, 429, { error: '잠시 후에 다시 시도해주세요.' }, origin);

    const payload = JSON.parse(await readBody(req));
    const slug = safeSlug(payload.slug);
    if (!slug) return send(res, 400, { error: '글을 찾을 수 없습니다.' }, origin);

    const result = await addComment(slug, payload);
    if (result.error) return send(res, 400, result, origin);
    return send(res, 201, { ok: true, pending: true }, origin);
  }

  return send(res, 405, { error: 'method not allowed' }, origin);
}

/** Astro 개발 서버가 뜰 때 같이 띄우고, 내려갈 때 같이 내린다. */
export function commentsDevApi() {
  return {
    name: 'heritage-comments-dev',
    apply: 'serve',
    configureServer(server) {
      const api = http.createServer((req, res) => {
        handle(req, res).catch((err) =>
          send(res, 400, { error: String(err?.message ?? err) }, req.headers.origin),
        );
      });

      api.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[댓글] ${COMMENTS_DEV_PORT} 포트가 이미 쓰이고 있습니다. 기존 서버를 그대로 씁니다.`);
        } else {
          console.error('[댓글]', err);
        }
      });

      api.listen(COMMENTS_DEV_PORT, '127.0.0.1', () => {
        console.log(`[댓글] 개발용 API — ${COMMENTS_DEV_ORIGIN}/api/comments`);
      });

      server.httpServer?.once('close', () => api.close());
    },
  };
}
