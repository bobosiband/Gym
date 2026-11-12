/**
 * Tunable thresholds for {@link DropoutTolerance}. `maxMissFrames`
 * defaults to 6, which is roughly 200 ms at 30 fps: long enough to
 * absorb a single-frame MediaPipe hiccup without pausing the rep,
 * short enough that the user noticing "the counter dropped me" lines
 * up with the detector actually dropping them.
 */
export interface DropoutToleranceOptions {
  readonly maxMissFrames: number;
}

const DEFAULTS: DropoutToleranceOptions = {
  maxMissFrames: 6,
};

/**
 * Counts consecutive bad frames so the detector can hold phase
 * through a brief landmark dropout instead of pausing mid-rep.
 * Semantics:
 *
 *  - `observeOk` clears the streak; the next frame starts fresh.
 *  - `observeMiss` increments the streak and returns `true` when the
 *    streak has exceeded the configured limit (that is, the dropout
 *    is no longer "brief" and the detector should pause).
 *  - `reset` clears the streak back to zero.
 */
export class DropoutTolerance {
  private readonly options: DropoutToleranceOptions;
  private missStreak: number = 0;

  public constructor(options: Partial<DropoutToleranceOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  public reset(): void {
    this.missStreak = 0;
  }

  public observeOk(): void {
    this.missStreak = 0;
  }

  /** Increment the miss streak; return `true` if the limit is exceeded. */
  public observeMiss(): boolean {
    this.missStreak += 1;
    return this.missStreak > this.options.maxMissFrames;
  }
}
