import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,  // React 개발 서버 포트
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',  // 백엔드 서버 주소
        changeOrigin: true,
        secure: false
        // rewrite 옵션 제거: /api/users가 그대로 /api/users로 전달됨
      }
    },
  },
  build: {
    outDir: 'dist'
  }
});