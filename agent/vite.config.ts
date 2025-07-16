import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist-react',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@3cx-ninja/shared': path.resolve(__dirname, '../shared/dist')
    }
  },
  server: {
    port: 5173
  }
});