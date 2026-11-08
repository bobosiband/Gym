import { defineConfig } from 'vitest/config';

/**
 * Vitest config for `@gym/exercise-core`.
 */
export default defineConfig({
  test: {
    include: ['../../tests/exercise-core/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
