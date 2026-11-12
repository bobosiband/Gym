/**
 * Moving-average smoother over a fixed-size window of numeric samples.
 *
 * The smoother is deliberately dumb: it holds the most recent `window`
 * samples and reports their mean. It is shared across every joint
 * angle the strict push-up detector tracks (left elbow, right elbow,
 * posture scores) so a single-frame jitter cannot flip the rep state
 * machine. A One Euro filter would be more faithful under rapid
 * movement but costs more to tune; a moving average is good enough
 * for the 24 to 30 Hz MediaPipe stream.
 */
export class AngleSmoother {
  private readonly windowSize: number;
  private readonly samples: number[] = [];
  private sum: number = 0;

  /**
   * @param windowSize Number of samples averaged together. Must be at
   *   least `1`. Values below `1` are coerced to `1` so the smoother
   *   is still well-defined under misuse.
   */
  public constructor(windowSize: number = 5) {
    this.windowSize = Math.max(1, Math.floor(windowSize));
  }

  /** Clear every sample and reset the running sum. */
  public reset(): void {
    this.samples.length = 0;
    this.sum = 0;
  }

  /**
   * Push a sample into the window and return the current running
   * mean. Before the window is full the mean reflects whatever
   * samples have been seen so far.
   */
  public push(value: number): number {
    this.samples.push(value);
    this.sum += value;
    if (this.samples.length > this.windowSize) {
      const removed = this.samples.shift() as number;
      this.sum -= removed;
    }
    return this.sum / this.samples.length;
  }

  /** Current running mean, or `null` before any sample has been seen. */
  public value(): number | null {
    if (this.samples.length === 0) {
      return null;
    }
    return this.sum / this.samples.length;
  }
}
