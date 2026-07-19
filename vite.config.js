import { defineConfig } from 'vite';
export default defineConfig({
  root: 'web',
  base: '/',
  publicDir: 'public',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 4000 },
});
