import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest configuration for apps/web. Tests run under jsdom so React
 * components can be rendered without a real browser. The test file
 * roots live under `tests/web/` at the repo root per the project's
 * convention of mirroring the service layout.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['../../tests/web/**/*.test.ts', '../../tests/web/**/*.test.tsx'],
    globals: false,
  },
});
