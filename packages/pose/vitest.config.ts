import { defineConfig } from 'vitest/config';

/**
 * Vitest config for `@gym/pose`.
 */
export default defineConfig({
  test: {
    include: ['../../tests/pose/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
