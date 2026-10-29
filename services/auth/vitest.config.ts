import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for @gym/auth.
 *
 * Tests run under Node, mirroring the Lambda runtime, and do not need
 * real AWS credentials: repositories, mailer, event publisher, and
 * clock are injected and replaced with in-memory fakes in each test.
 */
export default defineConfig({
  test: {
    include: ['../../tests/auth/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
