import type { Clock } from '../../../services/logging/src/util/Clock.js';

/**
 * `Clock` double that returns deterministic timestamps. Tests
 * drive time explicitly with `advanceSeconds`; nothing in the
 * service calls `Date.now()` directly so this is the sole source
 * of time.
 */
export class FakeClock implements Clock {
  private current: Date;

  public constructor(startIso = '2026-01-01T00:00:00.000Z') {
    this.current = new Date(startIso);
  }

  public nowIso(): string {
    return this.current.toISOString();
  }

  public nowSeconds(): number {
    return Math.floor(this.current.getTime() / 1000);
  }

  public advanceSeconds(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }

  public setIso(iso: string): void {
    this.current = new Date(iso);
  }
}
