/// <reference lib="webworker" />

/**
 * Service worker for the Gym PWA shell.
 *
 * The worker keeps a minimal cache for the shell files (HTML, built
 * assets, icons, manifest) so a user who has installed the PWA still
 * sees the welcome screen when they open the app offline. All API
 * requests (auth, logging, catalogue) are passed straight through to
 * the network and never cached: workout history must never be
 * served from stale storage.
 */

const CACHE_NAME = 'gym-shell-v1';
const SHELL_URLS: readonly string[] = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
];

declare const self: ServiceWorkerGlobalScope;

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
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Cross-origin requests go straight to the network: API calls to
    // the auth, logging and catalogue services belong to the service
    // layer's own cache rules, not the shell.
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached !== undefined) {
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          cache.put(request, response.clone()).catch(() => undefined);
        }
        return response;
      } catch (error) {
        const fallback = await cache.match('/index.html');
        if (fallback !== undefined) {
          return fallback;
        }
        throw error;
      }
    })()
  );
});

export {};
