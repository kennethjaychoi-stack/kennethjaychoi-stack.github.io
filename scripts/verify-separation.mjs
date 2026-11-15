/**
 * 공개 영역과 편집 영역이 실제로 분리되어 있는지 검사한다.
 *
 *   npm run verify
 *
 * 빌드 결과물(dist/)에 편집기 코드나 편집 API 가 한 조각이라도 섞이면
 * 실패하고 종료 코드 1 을 돌려준다. 배포 전에 돌리면 된다.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

/** dist 안에서 절대 나오면 안 되는 흔적들 */
const FORBIDDEN = [
  { needle: '@tiptap', why: 'Tiptap 편집기 라이브러리' },
  { needle: 'studio/', why: '편집기 소스 경로' },
  { needle: '/api/save', why: '글 저장 API' },
  { needle: '/api/upload', why: '사진 업로드 API' },
  { needle: '/api/delete', why: '글 삭제 API' },
  { needle: '/api/icons', why: '아이콘 목록 API' },
  { needle: 'IconPicker', why: '편집기 아이콘 피커' },
  { needle: 'heritage-admin-api', why: '편집 API 플러그인' },
  { needle: '/api/comments/moderate', why: '댓글 승인·삭제 API' },
  { needle: '/api/comments/pending', why: '검토 대기 댓글 API' },
  { needle: 'CommentQueue', why: '편집기 댓글 검토 화면' },
  { needle: '/api/comments/published', why: '올라간 댓글 목록 API' },
];

/** dist 에 반드시 있어야 하는 공개 페이지 */
const REQUIRED = ['index.html', 'map/index.html', 'heritage/index.html', 'about/index.html', 'rss.xml'];

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

try {
  await stat(DIST);
} catch {
  console.error('dist/ 가 없습니다. 먼저 npm run build 를 실행하세요.');
  process.exit(1);
}

const files = await walk(DIST);
const textFiles = files.filter((f) => /\.(html|js|css|xml|txt|json)$/i.test(f));

const leaks = [];
for (const file of textFiles) {
  const body = await readFile(file, 'utf8');
  for (const { needle, why } of FORBIDDEN) {
    if (body.includes(needle)) {
      leaks.push({ file: path.relative(ROOT, file), needle, why });
    }
  }
}

const missing = [];
for (const rel of REQUIRED) {
  try {
    await stat(path.join(DIST, rel));
  } catch {
    missing.push(rel);
  }
}

// content/.trash 가 공개되지 않았는지
const trashLeak = files.some((f) => f.includes('.trash'));

console.log(`검사한 파일: ${files.length}개 (텍스트 ${textFiles.length}개)`);
console.log('');

let failed = false;

if (leaks.length) {
  failed = true;
  console.error('❌ 편집기 코드가 공개 빌드에 섞였습니다:');
  for (const l of leaks) console.error(`   ${l.file} — ${l.why} ("${l.needle}")`);
} else {
  console.log('✅ 편집기 코드 없음 — dist/ 에 Tiptap·편집 API 흔적이 전혀 없습니다.');
}

if (trashLeak) {
  failed = true;
  console.error('❌ 휴지통(.trash) 파일이 공개 빌드에 포함됐습니다.');
} else {
  console.log('✅ 휴지통 비공개 — .trash 파일이 공개되지 않았습니다.');
}

if (missing.length) {
  failed = true;
  console.error(`❌ 공개 페이지 누락: ${missing.join(', ')}`);
} else {
  console.log(`✅ 공개 페이지 정상 — ${REQUIRED.length}개 모두 생성됨.`);
}

process.exit(failed ? 1 : 0);
