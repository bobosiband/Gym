import { defineConfig } from 'vitest/config';

/**
 * Vitest config for `@gym/progress`.
 *
 * Tests run under Node without any AWS SDK touching the network:
 * `tests/progress/support/` ships in-memory fakes for DynamoDB,
 * EventBridge, the clock, the id generator, and the JWT verifier.
 */
export default defineConfig({
  test: {
    include: ['../../tests/progress/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
