import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Relative base so the built index.html works when opened from disk (file://).
  base: './',
  plugins: [react(), viteSingleFile()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // The on-disk module cache does not notice YAML files added to the content glob,
    // which would let the integrity test pass against a stale catalog.
    fsModuleCache: false,
  },
})
