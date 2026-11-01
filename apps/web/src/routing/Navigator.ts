/**
 * Minimum shape of `window` the navigator needs. Tests pass a fake
 * so no real history manipulation happens.
 */
export interface NavigatorWindow {
  readonly history: Pick<History, 'pushState' | 'replaceState'>;
  readonly location: Pick<Location, 'pathname' | 'search'>;
  dispatchEvent(event: Event): boolean;
}

/**
 * Imperative navigation helper. Dispatches a synthetic `popstate`
 * after a `pushState` so router subscribers re-run the resolver and
 * the UI updates. Using the native `popstate` event instead of a
 * bespoke pub/sub keeps the browser's own back/forward buttons in
 * sync without extra wiring.
 */
export class Navigator {
  private readonly target: NavigatorWindow;

  public constructor(target: NavigatorWindow) {
    this.target = target;
  }

  /**
   * Push a new entry onto the history stack and notify subscribers.
   */
  public navigate(path: string): void {
    this.target.history.pushState(null, '', path);
    this.target.dispatchEvent(new Event('popstate'));
  }

  /**
   * Replace the current entry. Used for post-login redirects so the
   * login screen does not pile up in the back stack.
   */
  public replace(path: string): void {
    this.target.history.replaceState(null, '', path);
    this.target.dispatchEvent(new Event('popstate'));
  }
}
