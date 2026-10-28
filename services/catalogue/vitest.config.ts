import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['../../tests/catalogue/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
