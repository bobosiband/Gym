/**
 * Tiny clock port so tests can pin "now" without monkeypatching
 * `Date`. The service uses this everywhere it touches the current
 * time; the production adapter just returns `new Date().toISOString()`
 * (without trailing fractional seconds to match the ISO 8601 shape
 * used across the event bus).
 */
export interface Clock {
  nowIso(): string;
}

/** Production {@link Clock} backed by the real system time. */
export class SystemClock implements Clock {
  public nowIso(): string {
    return new Date().toISOString().replace(/\.\d+Z$/, '');
  }
}
