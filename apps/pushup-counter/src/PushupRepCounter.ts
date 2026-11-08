import type { PoseLandmarks } from '@gym/pose';
import { RepCounter } from '@gym/pose';
import { PushupRepDetector, type PushupRepDetectorOptions } from '@gym/exercise-pushup';

/**
 * Phase of the push-up motion inferred from the elbow angle.
 */
export type PushupPhase = 'unknown' | 'up' | 'down';

export type PushupRepCounterOptions = PushupRepDetectorOptions;

/**
 * Backward-compatible facade around {@link RepCounter} wired to a
 * {@link PushupRepDetector}. New callers should compose the two
 * directly; this class exists so the Stage 2 push-up tests and the
 * `apps/pushup-counter` React widget keep working while the Stage 3
 * generic exercise-embed widget rolls in.
 */
export class PushupRepCounter {
  private readonly detector: PushupRepDetector;
  private readonly counter: RepCounter;

  public constructor(options: Partial<PushupRepCounterOptions> = {}) {
    this.detector = new PushupRepDetector(options);
    this.counter = new RepCounter(this.detector);
  }

  /** Number of completed reps so far. */
  public getCount(): number {
    return this.counter.getCount();
  }

  /** Current inferred phase of the motion. */
  public getPhase(): PushupPhase {
    const observation = this.counter.getLastObservation();
    const label = observation?.phaseLabel;
    if (label === 'up' || label === 'down' || label === 'unknown') {
      return label;
    }
    return 'unknown';
  }

  /** Most recent elbow angle (degrees), or `null` if none processed. */
  public getLastElbowAngle(): number | null {
    return this.counter.getLastObservation()?.signalValue ?? null;
  }

  /** Reset the counter to its initial state; thresholds survive. */
  public reset(): void {
    this.counter.reset();
  }

  /**
   * Feed a frame of landmarks. Returns `true` if a new rep was
   * completed on this frame, `false` otherwise.
   */
  public processFrame(landmarks: PoseLandmarks): boolean {
    return this.counter.processFrame(landmarks);
  }
}
