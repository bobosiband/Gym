import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest configuration for `apps/pushup-counter`. Tests run under
 * jsdom so the React widget can be rendered without a browser; the
 * MediaPipe adapter is swapped for a scripted stub so no model
 * download or camera access happens during the test run.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: [
      '../../tests/pushup-counter/**/*.test.ts',
      '../../tests/pushup-counter/**/*.test.tsx',
    ],
    setupFiles: ['../../tests/pushup-counter/support/setupReactAct.ts'],
    globals: false,
  },
});
