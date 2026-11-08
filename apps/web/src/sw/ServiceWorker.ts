/// <reference lib="webworker" />

/**
 * Service worker for the Gym PWA shell.
 *
 * Caching strategy:
 *
 *  - Navigations and `/index.html`: network-first. The latest shell
 *    HTML wins every time the user is online, so a new deploy is
 *    visible on the next page load. Offline the request falls back to
 *    the cached shell so the installed PWA still boots.
 *  - `/assets/*`: cache-first. The filenames are hashed by Vite, so a
 *    cached asset is safe to serve forever. Misses are fetched and
 *    persisted.
 *  - Other same-origin static files (icons, manifest): cache-first.
 *  - Cross-origin requests (auth, logging, catalogue, media, etc.):
 *    straight to the network. Workout history must never be served
 *    from stale storage.
 *
 * Deploy coherence is tied to the build ID injected by Vite's
 * `define` (see `apps/web/vite.config.ts`). Each build produces a new
 * cache name (`gym-shell-<buildId>`); on `activate` every older
 * `gym-shell-*` cache is deleted so a stale asset cannot resurrect
 * itself after a rollback. The client in `registerServiceWorker.ts`
 * reloads once on `controllerchange` so the user picks up the new
 * shell without a manual refresh.
 */

declare const __BUILD_ID__: string;
declare const self: ServiceWorkerGlobalScope;

const CACHE_PREFIX = 'gym-shell-';
const CACHE_NAME = `${CACHE_PREFIX}${__BUILD_ID__}`;
const SHELL_URLS: readonly string[] = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(SHELL_URLS);
    })()
  );
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

/**
 * Is the request a page navigation? The browser sets
 * `request.mode === 'navigate'` on top-level navigations; a few older
 * platforms do not, so this check falls back to the HTML
 * `Accept` hint.
 */
function isNavigation(request: Request): boolean {
  if (request.mode === 'navigate') {
    return true;
  }
  const accept = request.headers.get('accept') ?? '';
  return accept.includes('text/html');
}

function isHashedAsset(url: URL): boolean {
  return url.pathname.startsWith('/assets/');
}

async function networkFirstWithShellFallback(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      cache.put('/index.html', response.clone()).catch(() => undefined);
    }
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) ?? (await cache.match('/index.html'));
    if (cached !== undefined) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached !== undefined) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (isNavigation(request) || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(networkFirstWithShellFallback(request));
    return;
  }
  if (isHashedAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

export {};
