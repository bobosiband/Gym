import type { Clock } from '../../../services/auth/src/util/Clock.js';

/**
 * Deterministic `Clock` for tests. Starts at the provided ISO
 * timestamp and advances only when `advanceSeconds` is called, so
 * token expiry can be exercised without `vi.useFakeTimers`.
 */
export class FakeClock implements Clock {
  private millis: number;

  public constructor(startIso: string = '2026-01-01T00:00:00Z') {
    this.millis = new Date(startIso).getTime();
  }

  public now(): Date {
    return new Date(this.millis);
  }

  public nowMillis(): number {
    return this.millis;
  }

  public nowSeconds(): number {
    return Math.floor(this.millis / 1000);
  }

  public advanceSeconds(seconds: number): void {
    this.millis += seconds * 1000;
  }
}
