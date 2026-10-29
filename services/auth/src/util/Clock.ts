/**
 * Narrow abstraction over the system clock so tests can advance time
 * deterministically without `vi.useFakeTimers`. Implementations return
 * either a `Date` or a numeric epoch; the business logic consumes
 * whichever shape is handy.
 */
export interface Clock {
  /** Current wall-clock time. */
  now(): Date;
  /** Current time in whole seconds since the Unix epoch. */
  nowSeconds(): number;
  /** Current time in milliseconds since the Unix epoch. */
  nowMillis(): number;
}

/**
 * Clock backed by the system clock. Used by all production code paths;
 * tests inject a `FakeClock` from `tests/auth/support` instead.
 */
export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }

  public nowMillis(): number {
    return Date.now();
  }

  public nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }
}
