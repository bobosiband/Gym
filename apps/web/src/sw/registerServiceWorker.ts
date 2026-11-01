/**
 * Register the compiled service worker from the browser side.
 *
 * The function is a no-op on browsers that do not support service
 * workers so the app still works for them. Any registration failure
 * is logged and swallowed: a failed install must never block the
 * shell from loading.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    console.warn('Service worker registration failed', error);
  }
}
