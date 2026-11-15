import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';
// 개발 중에만 붙는 댓글 API. 빌드 결과물에는 들어가지 않습니다.
import { commentsDevApi } from './scripts/comments-dev.mjs';

import { SITE } from './site/consts';

/**
 * 공개 사이트 빌드 설정.
 *
 * 여기서 만들어지는 dist/ 만 배포됩니다.
 * 편집기(studio/)는 이 설정이 아예 쳐다보지 않으므로
 * 어떤 경우에도 공개 사이트에 섞여 들어갈 수 없습니다.
 */
export default defineConfig({
  // 공개 영역은 site/ 안에만 있다
  srcDir: './site',
  publicDir: './public',
  outDir: './dist',

  // 도메인을 구입하면 site/consts.ts 의 SITE.url 한 줄만 바꾸면
  // 사이트맵·RSS·OG 태그·정규 URL 이 모두 따라갑니다.
  site: SITE.url,
  trailingSlash: 'always',

  integrations: [react(), sitemap(), icon({ iconDir: 'site/icons' })],
  vite: {
    plugins: [tailwindcss(), commentsDevApi()],
  },
  markdown: {
    // Tiptap 이 저장한 HTML 은 Astro 가 기본적으로 그대로 통과시킵니다.
    shikiConfig: { theme: 'github-light', wrap: true },
  },
});
