import type { PoseLandmarks } from './PoseLandmark.js';
import type { RepDetector, RepObservation } from './RepDetector.js';

/**
 * Generic rep counter driven by a pluggable {@link RepDetector}.
 *
 * The counter is deliberately exercise-agnostic. It owns the running
 * total and the most recent observation; the detector owns the
 * motion-specific state machine. This split means swapping a push-up
 * for a squat is a change of detector, never of counting code.
 */
export class RepCounter {
  private count: number = 0;
  private lastObservation: RepObservation | null = null;

  public constructor(private readonly detector: RepDetector) {}

  /** Number of completed reps so far. */
  public getCount(): number {
    return this.count;
  }

  /** Most recent observation, or `null` before any frame is seen. */
  public getLastObservation(): RepObservation | null {
    return this.lastObservation;
  }

  /**
   * Reset the counter and its detector. Threshold or configuration
   * held by the detector survives; only the motion state resets.
   */
  public reset(): void {
    this.count = 0;
    this.lastObservation = null;
    this.detector.reset();
  }

  /**
   * Feed a frame of landmarks. Returns `true` if a new rep was
   * completed on this frame, `false` otherwise.
   */
  public processFrame(landmarks: PoseLandmarks): boolean {
    const observation = this.detector.processFrame(landmarks);
    this.lastObservation = observation;
    if (observation.repCompleted) {
      this.count += 1;
      return true;
    }
    return false;
  }
}
