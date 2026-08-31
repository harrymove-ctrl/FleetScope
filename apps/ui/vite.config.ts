import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Served under Astro as /ui/#/embed/... after build.
  base: '/ui/',
  build: {
    outDir: path.resolve(__dirname, '../web/public/ui'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    // Allow Astro (4321) to iframe this lab during local verify.
    cors: true,
    headers: {
      'Content-Security-Policy':
        "frame-ancestors 'self' http://127.0.0.1:4321 http://localhost:4321",
    },
  },
});
