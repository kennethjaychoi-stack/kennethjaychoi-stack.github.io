/**
 * 댓글 저장소.
 *
 * 글 한 편당 파일 하나: content/comments/<slug>.json
 * 데이터베이스를 두지 않는 건 글과 같은 이유입니다 — git 이 이력과 백업을 맡습니다.
 *
 * 공개 사이트(읽기)와 편집기(승인·삭제)가 이 파일을 함께 씁니다.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
export const COMMENTS_DIR = path.join(ROOT, 'content', 'comments');

/** 한 사람이 쓸 수 있는 길이. 넘으면 거절합니다. */
export const LIMITS = { name: 20, body: 1000 };

/** 파일 이름으로 쓸 수 없는 글자를 걸러낸다. 글 slug 와 같은 규칙. */
export function safeSlug(slug) {
  const s = String(slug ?? '')
    .normalize('NFC')
    .trim()
    .replace(/[/\\]/g, '-')
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return s || null;
}

/** 사람이 보낸 글자에서 제어문자를 빼고 길이를 자른다. */
function clean(value, max) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim()
    .slice(0, max);
}

function fileFor(slug) {
  return path.join(COMMENTS_DIR, `${slug}.json`);
}

async function readRaw(slug) {
  try {
    return JSON.parse(await readFile(fileFor(slug), 'utf8'));
  } catch {
    return { slug, comments: [] };
  }
}

async function writeRaw(slug, data) {
  await mkdir(COMMENTS_DIR, { recursive: true });
  await writeFile(fileFor(slug), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** 방문자에게 보여줄 것만. 고정한 댓글이 먼저, 그다음 오래된 순. */
export async function listApproved(slug) {
  const { comments } = await readRaw(slug);
  return comments
    .filter((c) => c.approved)
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return String(a.at).localeCompare(String(b.at));
    })
    .map(({ id, name, body, at, pinned }) => ({ id, name, body, at, pinned: Boolean(pinned) }));
}

/** 편집기에서 볼 것. 승인 여부와 관계없이 전부. */
export async function listAll(slug) {
  const { comments } = await readRaw(slug);
  return [...comments].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** 아직 승인하지 않은 댓글을 글과 상관없이 모두 모은다. */
export async function listPending() {
  let files = [];
  try {
    files = await readdir(COMMENTS_DIR);
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const slug = f.slice(0, -5);
    for (const c of await listAll(slug)) {
      if (!c.approved) out.push({ ...c, slug });
    }
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/**
 * 댓글을 받는다. 바로 공개되지 않고 승인 대기 상태로 들어간다.
 * 거절할 이유가 있으면 { error } 를 돌려준다.
 */
export async function addComment(slug, { name, body, honeypot }) {
  // 봇이 채우는 보이지 않는 칸. 사람이 쓴 게 아니므로 조용히 버린다.
  if (honeypot) return { ok: true, silent: true };

  const text = clean(body, LIMITS.body);
  if (text.length < 2) return { error: '댓글을 입력해주세요.' };

  const who = clean(name, LIMITS.name) || '익명';

  const data = await readRaw(slug);

  // 같은 내용을 연달아 보내는 건 받지 않는다.
  const last = data.comments[data.comments.length - 1];
  if (last && last.body === text && last.name === who) {
    return { error: '방금 쓴 댓글과 같습니다.' };
  }

  const comment = {
    id: crypto.randomUUID(),
    name: who,
    body: text,
    at: new Date().toISOString(),
    approved: false,
    pinned: false,
  };
  data.slug = slug;
  data.comments.push(comment);
  await writeRaw(slug, data);
  return { ok: true, comment };
}

export async function setApproved(slug, id, approved) {
  const data = await readRaw(slug);
  const c = data.comments.find((x) => x.id === id);
  if (!c) return { error: '없는 댓글입니다.' };
  c.approved = Boolean(approved);
  await writeRaw(slug, data);
  return { ok: true };
}

/** 댓글 고정 — 글 맨 위에 붙는다. 승인된 댓글만 고정할 수 있다. */
export async function setPinned(slug, id, pinned) {
  const data = await readRaw(slug);
  const c = data.comments.find((x) => x.id === id);
  if (!c) return { error: '없는 댓글입니다.' };
  if (pinned && !c.approved) return { error: '먼저 올린 뒤에 고정할 수 있습니다.' };
  c.pinned = Boolean(pinned);
  await writeRaw(slug, data);
  return { ok: true };
}

/** 이미 올라간 댓글을 글과 상관없이 모두 모은다. 편집기에서 고정·삭제할 때 쓴다. */
export async function listPublished() {
  let files = [];
  try {
    files = await readdir(COMMENTS_DIR);
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const slug = f.slice(0, -5);
    for (const c of await listAll(slug)) {
      if (c.approved) out.push({ ...c, slug });
    }
  }
  return out.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return String(b.at).localeCompare(String(a.at));
  });
}

export async function removeComment(slug, id) {
  const data = await readRaw(slug);
  const before = data.comments.length;
  data.comments = data.comments.filter((x) => x.id !== id);
  if (data.comments.length === before) return { error: '없는 댓글입니다.' };
  await writeRaw(slug, data);
  return { ok: true };
}
