import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

/**
 * Vitest configuration for @gym/media.
 *
 * Tests run inside a Cloudflare Workers isolate via Miniflare, so the
 * R2 binding behaves exactly as it does in production (writes land in
 * an in-memory bucket per test file). No real Cloudflare account is
 * touched during the test run.
 */
export default defineWorkersConfig({
  test: {
    include: ['../../tests/media/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          compatibilityDate: '2025-10-15',
          r2Buckets: ['MEDIA'],
          bindings: {
            ALLOWED_ORIGINS: 'http://localhost:5173,https://trusted.example',
            MAX_AGE_SECONDS: '3600',
          },
        },
      },
    },
  },
});
