import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for @gym/logging.
 *
 * Tests run under Node, mirroring the Lambda runtime, and do not need
 * real AWS credentials: repositories, event publisher, clock, id
 * generator, and JWT verifier are injected and replaced with
 * in-memory fakes in each test.
 */
export default defineConfig({
  test: {
    include: ['../../tests/logging/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
