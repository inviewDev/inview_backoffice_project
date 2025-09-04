import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  optimizeDeps: {
    exclude: ['jwt-decode'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: false
      }
    },
    css: {
      devSourcemap: true,
      modules: {
        generateScopedName: '[name]__[local]__[hash:base64:5]' 
      }
    },
    assetsInlineLimit: 0 
  }
});