import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

/**
 * Vitest configuration for @gym/achievements.
 *
 * Tests run inside a Cloudflare Workers isolate via Miniflare so
 * integration tests get a real local D1 database and the Worker
 * runs exactly as it will in production.
 */
export default defineWorkersConfig({
  test: {
    include: ['../../tests/achievements/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          compatibilityDate: '2025-10-15',
          d1Databases: ['DB'],
          bindings: {
            ALLOWED_ORIGINS: '*',
            INTERNAL_EVENTS_KEY: 'test-internal-key',
            JWT_ISSUER: 'https://auth.gym.local/ap-southeast-2',
            JWT_AUDIENCE: 'gym-api',
            JWKS_URL: 'https://test.local/.well-known/jwks.json',
          },
        },
      },
    },
  },
});
