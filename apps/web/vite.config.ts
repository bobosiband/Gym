import { execSync } from 'node:child_process';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Resolve a short build identifier. Prefers the git SHA so each
 * deploy of the shell produces a distinct service-worker cache name;
 * falls back to a timestamp when the build runs outside a git
 * checkout (for example a Docker build context with no .git).
 */
function resolveBuildId(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().slice(0, 12);
  } catch {
    return `local-${Date.now().toString(36)}`;
  }
}

/**
 * Vite configuration for the Gym PWA shell.
 *
 * The build produces a single-page app rooted at `/index.html` and
 * copies the contents of `public/` verbatim. The service worker
 * source is bundled from `src/sw/` to `/sw.js`. Vercel is configured
 * via `vercel.json` to rewrite unknown paths back to `/index.html`
 * so client-side routing survives a direct URL hit or a page
 * refresh.
 *
 * `__BUILD_ID__` is injected into the service-worker bundle so each
 * deploy owns its own cache name. The old caches are deleted on
 * `activate`; see `src/sw/ServiceWorker.ts`.
 */
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(resolveBuildId()),
  },
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
