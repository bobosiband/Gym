import type { PoseLandmarks } from './PoseLandmark.js';

/**
 * Observation returned by {@link RepDetector.processFrame}.
 *
 * `repCompleted` is `true` for exactly the frame on which a rep
 * finishes. `phaseLabel` and `signalValue` are optional observability
 * hooks for the UI (for example "down | 92 degrees") and never
 * influence counting logic.
 */
export interface RepObservation {
  readonly repCompleted: boolean;
  readonly phaseLabel?: string;
  readonly signalValue?: number;
}

/**
 * Pluggable strategy for turning a stream of pose frames into a rep
 * count. Each registered exercise supplies its own detector:
 *
 *  - Push-ups watch elbow angle crossings.
 *  - Squats watch hip-knee angle crossings.
 *  - Planks measure hold time rather than peaks.
 *
 * Detectors must be stateful (they track motion between frames) and
 * must support {@link reset} so a user can restart a session without
 * reconstructing the instance.
 */
export interface RepDetector {
  processFrame(landmarks: PoseLandmarks): RepObservation;
  reset(): void;
}
