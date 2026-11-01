/**
 * Monotonic-ish clock boundary. Injected so tests can freeze time.
 * The service never calls `Date.now()` directly; every reference to
 * "now" flows through this interface.
 */
export interface Clock {
  nowIso(): string;
  nowSeconds(): number;
}

/**
 * Production clock backed by `Date.now`.
 */
export class SystemClock implements Clock {
  public nowIso(): string {
    const date = new Date();
    const iso = date.toISOString();
    const [withoutMs] = iso.split('.');
    return `${withoutMs ?? iso.slice(0, 19)}`;
  }

  public nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }
}
