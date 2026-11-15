/**
 * 샘플 글에 걸린 사진 자리를 채우는 placeholder 를 만든다.
 * 실제 사진을 올리면 같은 파일명으로 덮어쓰면 된다.
 *
 *   npm run placeholders
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');

const TARGETS = [
  ['수원화성-답사', '01-화서문', '수원화성 · 화서문'],
  ['수원화성-답사', '02-방화수류정', '수원화성 · 방화수류정'],
  ['공주-무령왕릉', '01-왕릉원', '공주 · 무령왕릉과 왕릉원'],
  ['공주-무령왕릉', '02-모형전시관', '공주 · 모형전시관'],
  ['국립중앙박물관-사유의방', '01-사유의방', '국립중앙박물관 · 사유의 방'],
  ['국립중앙박물관-사유의방', '02-반가사유상', '국립중앙박물관 · 반가사유상'],
  ['국립경주박물관-특별전-신라의-금속', '01-금관', '국립경주박물관 · 금관'],
  ['국립경주박물관-특별전-신라의-금속', '02-금허리띠', '국립경주박물관 · 금허리띠'],
];

const W = 1600;
const H = 1067;

const svg = (label) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#EFE9E0"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="#D8CFC2" stroke-width="2"/>
  <text x="50%" y="48%" text-anchor="middle" font-family="Apple SD Gothic Neo, sans-serif"
        font-size="52" fill="#8A8077">${label}</text>
  <text x="50%" y="56%" text-anchor="middle" font-family="Apple SD Gothic Neo, sans-serif"
        font-size="28" fill="#ABA29A">사진 자리 — 실제 사진으로 덮어쓰세요</text>
</svg>`;

let made = 0;
for (const [slug, name, label] of TARGETS) {
  const dir = path.join(ROOT, 'public/images/posts', slug);
  await mkdir(dir, { recursive: true });
  const buf = await sharp(Buffer.from(svg(label))).webp({ quality: 80 }).toBuffer();
  await writeFile(path.join(dir, `${name}.webp`), buf);
  made++;
}

console.log(`placeholder ${made}장을 만들었습니다. (public/images/posts/)`);
