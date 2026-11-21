/**
 * 편집기 화면에서 쓰는 아이콘을 studio/fa-icons.js 로 뽑아낸다.
 *
 *   node scripts/fa-icons.mjs
 *
 * 아이콘을 더하려면 아래 WANT 에 이름을 적고 다시 돌리세요.
 * 이름은 Font Awesome 무료 solid 아이콘 이름입니다 (fontawesome.com/search).
 *
 * 왜 통째로 불러오지 않는가 — fa6-solid 전체는 1,000개가 넘습니다.
 * 화면에 쓰는 24개만 박아 두면 편집기가 뜨는 순간 바로 그려집니다.
 * (본문에 넣는 아이콘은 /api/icons 로 전체를 검색합니다. 그건 별개입니다.)
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const WANT = [
  'xmark', 'eraser', 'quote-left', 'minus',
  'align-left', 'align-center', 'align-right',
  'link', 'image', 'up-right-and-down-left-from-center', 'table-cells', 'code', 'icons',
  'rotate-left', 'rotate-right', 'list-ul', 'list-ol',
  'plus', 'comments', 'floppy-disk', 'trash-can', 'chevron-right', 'eye', 'pen',
];

const set = JSON.parse(
  await readFile(path.join(ROOT, 'node_modules/@iconify-json/fa6-solid/icons.json'), 'utf8'),
);

const missing = WANT.filter((n) => !set.icons[n]);
if (missing.length) {
  console.error('없는 아이콘:', missing.join(', '));
  process.exit(1);
}

const out = {};
for (const n of WANT) {
  const i = set.icons[n];
  out[n] = { v: `0 0 ${i.width ?? set.width ?? 512} ${i.height ?? set.height ?? 512}`, d: i.body };
}

const head = `/**
 * 편집기 화면에서 쓰는 Font Awesome(fa6-solid) 아이콘.
 *
 * 이모지 대신 씁니다 — 이모지는 운영체제마다 모양이 달라지고
 * 글꼴에 따라 아예 안 보이기도 합니다.
 *
 * 이 파일은 손으로 고치지 않습니다. 아이콘을 더하려면
 * scripts/fa-icons.mjs 를 고쳐 다시 만드세요.
 */
export const FA = `;

await writeFile(path.join(ROOT, 'studio/fa-icons.js'), head + JSON.stringify(out, null, 2) + ';\n');
console.log(`studio/fa-icons.js — 아이콘 ${WANT.length}개`);
