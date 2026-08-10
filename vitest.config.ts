import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // `server-only` throws on import unless the bundler picks its
      // react-server condition — which is exactly the guard we want in the app,
      // and exactly the thing that stops a unit test importing a module that
      // declares it. Swap it for a no-op here; Next still enforces the real one.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
})
