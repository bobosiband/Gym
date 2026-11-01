/**
 * Clock boundary. Kept behind an interface so tests can inject a
 * `FakeClock` that returns deterministic ISO timestamps without
 * reaching for `vi.useFakeTimers()`.
 */
export interface Clock {
  /**
   * Returns the current wall-clock time as an ISO 8601 UTC string
   * (`YYYY-MM-DDTHH:mm:ss.sssZ`), the same format `Date#toISOString`
   * produces and the same format the workoutLogged.v1 schema accepts.
   */
  nowIso(): string;

  /**
   * Returns the current wall-clock time as Unix seconds. Used for
   * DynamoDB TTL values.
   */
  nowSeconds(): number;
}

/**
 * Production `Clock` backed by `Date`.
 */
export class SystemClock implements Clock {
  public nowIso(): string {
    return new Date().toISOString();
  }

  public nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }
}
