import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite configuration for the Gym PWA shell.
 *
 * The build produces a single-page app rooted at `/index.html` and
 * copies the contents of `public/` verbatim (manifest, icons, service
 * worker source is bundled from `src/sw/`). Vercel is configured via
 * `vercel.json` to rewrite all unknown paths back to `/index.html` so
 * client-side routing survives a direct URL hit or a page refresh.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html',
        sw: './src/sw/ServiceWorker.ts',
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js',
      },
    },
  },
});
