import { defineConfig } from 'vitest/config';

/**
 * Vitest config for `@gym/exercise-pushup`.
 */
export default defineConfig({
  test: {
    include: ['../../tests/exercise-pushup/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
