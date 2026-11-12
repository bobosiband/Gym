/**
 * Tunable thresholds for {@link RepTimingGate}. Defaults match the
 * owner brief: a 0.4 s lower bound rejects hand waves while a
 * ten-second upper bound rejects static holds that happen to pass
 * through both thresholds (for example a stretch).
 */
export interface RepTimingGateOptions {
  readonly minRepSeconds: number;
  readonly maxRepSeconds: number;
}

const DEFAULTS: RepTimingGateOptions = {
  minRepSeconds: 0.4,
  maxRepSeconds: 10,
};

/**
 * Rejects reps whose total duration (down to up) lies outside a
 * configurable window. Owns the timestamp of the last down-phase
 * entry; the strict detector queries {@link isDurationValid} at the
 * moment it would otherwise count a rep.
 */
export class RepTimingGate {
  private readonly options: RepTimingGateOptions;
  private downEnteredAtMs: number | null = null;

  public constructor(options: Partial<RepTimingGateOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Clear the stored down-phase timestamp. */
  public reset(): void {
    this.downEnteredAtMs = null;
  }

  /**
   * Mark the instant the user entered the down phase. Called from the
   * state machine whenever the phase transitions to `down`.
   */
  public markDown(nowMs: number): void {
    this.downEnteredAtMs = nowMs;
  }

  /**
   * Called at the candidate rep boundary (down to up transition).
   * Returns `true` iff the elapsed time between the stored down
   * timestamp and `nowMs` falls inside `[minRepSeconds, maxRepSeconds]`.
   * Returns `false` when no down timestamp has been recorded.
   */
  public isDurationValid(nowMs: number): boolean {
    if (this.downEnteredAtMs === null) {
      return false;
    }
    const elapsedSeconds = (nowMs - this.downEnteredAtMs) / 1000;
    return (
      elapsedSeconds >= this.options.minRepSeconds && elapsedSeconds <= this.options.maxRepSeconds
    );
  }
}
