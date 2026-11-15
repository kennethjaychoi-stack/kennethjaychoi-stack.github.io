import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { adminApi } from './server.mjs';

/**
 * 편집기는 Astro 와 분리된 로컬 전용 앱입니다.
 * `npm run studio` 로만 실행되고 빌드 결과물(dist/)에는 포함되지 않습니다.
 */
export default defineConfig({
  root: import.meta.dirname,

  /**
   * 사진은 프로젝트의 public/ 에 저장된다.
   * 이걸 지정하지 않으면 편집기에서 /images/... 가 404 가 되어
   * 올린 사진이 깨진 그림으로 보인다. (공개 사이트에서는 정상)
   */
  publicDir: path.resolve(import.meta.dirname, '../public'),

  server: {
    port: 4322,
    host: '127.0.0.1', // 같은 네트워크의 다른 기기에서는 열리지 않게 한다
    open: true,
  },
  plugins: [react(), adminApi()],
});
