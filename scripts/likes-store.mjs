/**
 * 좋아요 저장소.
 *
 * 글 하나당 숫자 하나뿐이라 파일 한 장에 모아 둡니다: content/likes.json
 * 누가 눌렀는지는 남기지 않습니다 — 셀 수만 있으면 되고, 적게 남길수록 좋습니다.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'content');
const FILE = path.join(DIR, 'likes.json');

/** 같은 파일에 동시에 쓰지 않도록 줄을 세운다. */
let queue = Promise.resolve();

async function readAll() {
  try {
    const data = JSON.parse(await readFile(FILE, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export async function getLikes(slug) {
  const all = await readAll();
  return Number(all[slug] ?? 0);
}

/** delta 는 +1 또는 -1. 0 아래로는 내려가지 않는다. */
export async function bumpLikes(slug, delta) {
  const step = delta < 0 ? -1 : 1;
  const run = queue.then(async () => {
    const all = await readAll();
    const next = Math.max(0, Number(all[slug] ?? 0) + step);
    all[slug] = next;
    await mkdir(DIR, { recursive: true });
    await writeFile(FILE, JSON.stringify(all, null, 2) + '\n', 'utf8');
    return next;
  });
  // 실패해도 줄이 끊기지 않게 한다
  queue = run.catch(() => {});
  return run;
}
