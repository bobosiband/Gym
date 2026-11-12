import type { PoseLandmarks } from './PoseLandmark.js';

/**
 * Observation returned by {@link RepDetector.processFrame}.
 *
 * `repCompleted` is `true` for exactly the frame on which a rep
 * finishes. `phaseLabel`, `signalValue`, `view` and `failReason` are
 * optional observability hooks for the UI (for example
 * "down | 92 degrees | view front") and never influence counting
 * logic. `view` is the camera-angle classification the detector most
 * recently settled on; `failReason` carries the short tag of the
 * specific check that rejected the current frame (for example
 * "wrists not below shoulders") so the UI can point the user at it.
 */
export interface RepObservation {
  readonly repCompleted: boolean;
  readonly phaseLabel?: string;
  readonly signalValue?: number;
  readonly view?: 'front' | 'side' | 'unknown';
  readonly failReason?: string;
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
