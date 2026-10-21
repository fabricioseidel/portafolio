import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const contentDir = process.env.CONTENT_DIR ? path.resolve(process.env.CONTENT_DIR) : '';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Igual que next.config.ts: con CONTENT_DIR el sitio y sus tests leen el contenido externo.
      ...(contentDir ? [{ find: /^@content\/site\.json$/, replacement: path.join(contentDir, 'content', 'site.json') }] : []),
      { find: '@content', replacement: root('./content') },
      { find: '@', replacement: root('./src') },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
