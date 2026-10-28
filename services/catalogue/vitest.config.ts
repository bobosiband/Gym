import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

/**
 * Vitest configuration for @gym/catalogue.
 *
 * Tests run inside a Cloudflare Workers isolate via Miniflare, so
 * integration tests get a real local D1 database and the Worker runs
 * exactly as it will in production. Pure unit tests also work in this
 * environment because they only touch standard Fetch and URL APIs.
 */
export default defineWorkersConfig({
  test: {
    include: ['../../tests/catalogue/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          compatibilityDate: '2025-10-15',
          d1Databases: ['DB'],
          bindings: {
            ALLOWED_ORIGINS: 'http://localhost:5173,https://trusted.example',
          },
        },
      },
    },
  },
});
