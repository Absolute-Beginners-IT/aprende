import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { configDefaults, defineConfig } from 'vitest/config'
import packageJson from './package.json'

// The planner document's module is shared with «Mi infraestructura» (../shared); `zod` resolves from these guides'
// node_modules. These guides have no Node types, so the folder comes from the URL by hand: decoded, and without the
// slash URLs put before a Windows drive letter.
const sharedDir = decodeURIComponent(new URL('../shared', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1')

export default defineConfig({
  // Relative base so the built index.html works when opened from disk (file://).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { '@shared': sharedDir }, dedupe: ['zod'] },
  server: { fs: { allow: ['.', sharedDir] } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Worktrees of parallel sessions live under .claude/ and would run their copy of every test.
    exclude: [...configDefaults.exclude, '.claude/**'],
    // The on-disk module cache does not notice YAML files added to the content glob,
    // which would let the integrity test pass against a stale catalog.
    fsModuleCache: false,
  },
})
