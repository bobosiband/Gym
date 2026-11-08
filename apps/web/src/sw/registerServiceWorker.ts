/**
 * Register the compiled service worker from the browser side.
 *
 * The function is a no-op on browsers that do not support service
 * workers so the app still works for them. Any registration failure
 * is logged and swallowed: a failed install must never block the
 * shell from loading.
 *
 * On `controllerchange` the page reloads exactly once. Each build
 * produces a new cache name (see `ServiceWorker.ts`) so the old
 * worker always calls `clients.claim()` and the user picks up the
 * new shell without a manual refresh. The reload guard prevents an
 * infinite loop if a browser extension installs a competing worker.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) {
      return;
    }
    reloaded = true;
    window.location.reload();
  });
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    console.warn('Service worker registration failed', error);
  }
}
