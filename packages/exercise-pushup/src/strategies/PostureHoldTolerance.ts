/**
 * Tunable thresholds for {@link PostureHoldTolerance}.
 *
 *  - `pauseAfterMs` is how long the user has to be continuously out
 *    of position before the detector declares a pause and resets the
 *    in-flight rep state. Defaults to 1000 ms per the owner brief; a
 *    brief wobble inside the window never cancels a rep.
 */
export interface PostureHoldToleranceOptions {
  readonly pauseAfterMs: number;
}

const DEFAULTS: PostureHoldToleranceOptions = {
  pauseAfterMs: 1000,
};

/**
 * Time-based position-hold watchdog. The detector asks it on every
 * frame whether the current out-of-position streak has lasted long
 * enough to abort the rep in progress; a short lapse answers "no" and
 * the detector leaves the rep state untouched.
 *
 * Semantics:
 *
 *  - `observeOk(nowMs)` clears the streak; the next lapse starts
 *    fresh.
 *  - `observeMiss(nowMs)` starts or continues the streak. Returns
 *    `true` once the streak has exceeded {@link pauseAfterMs}.
 *  - `reset()` clears the streak back to zero.
 */
export class PostureHoldTolerance {
  private readonly options: PostureHoldToleranceOptions;
  private missStartedAtMs: number | null = null;

  public constructor(options: Partial<PostureHoldToleranceOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  public reset(): void {
    this.missStartedAtMs = null;
  }

  public observeOk(): void {
    this.missStartedAtMs = null;
  }

  /**
   * Record a bad frame at `nowMs`. Returns `true` when the current
   * streak has lasted longer than {@link pauseAfterMs}.
   */
  public observeMiss(nowMs: number): boolean {
    if (this.missStartedAtMs === null) {
      this.missStartedAtMs = nowMs;
      return false;
    }
    return nowMs - this.missStartedAtMs >= this.options.pauseAfterMs;
  }
}
