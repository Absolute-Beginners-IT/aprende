import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Shared content lives outside the app root (../content), so the dev server must be allowed to read it.
const contentDir = fileURLToPath(new URL('../content', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@content': contentDir } },
  server: { fs: { allow: ['.', contentDir] } },
  test: { environment: 'node' },
});
