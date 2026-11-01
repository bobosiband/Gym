import type { PoseLandmarks } from './PoseLandmark.js';

/**
 * Callback invoked for each pose frame produced by a source.
 */
export type PoseFrameListener = (landmarks: PoseLandmarks) => void;

/**
 * Minimal interface implemented by MediaPipe-backed and in-memory
 * pose sources. Keeping the pushup widget behind this interface means
 * tests can drive it with a fake source and the production browser
 * stack can plug in MediaPipe without any widget changes.
 */
export interface PoseSource {
  /**
   * Begin producing frames. Subsequent calls while already running
   * are a no-op. May throw if the underlying device (camera) cannot
   * be acquired; the widget maps the throw to a visible error.
   */
  start(listener: PoseFrameListener): Promise<void>;

  /**
   * Stop producing frames and release any held resources. Idempotent.
   */
  stop(): Promise<void>;
}
