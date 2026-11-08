/**
 * Public entry point for `@gym/pose`.
 *
 * Exports pure types (landmarks, source interface, detector) and the
 * generic {@link RepCounter}. The browser-only MediaPipe adapter is
 * available at the `./browser` subpath so Node consumers never pull
 * in DOM typings.
 */

export type { PoseLandmark, PoseLandmarks } from './PoseLandmark.js';
export { PoseLandmarkIndex } from './PoseLandmark.js';
export { PoseGeometry } from './PoseGeometry.js';
export type { PoseFrameListener, PoseSource } from './PoseSource.js';
export type { RepDetector, RepObservation } from './RepDetector.js';
export { RepCounter } from './RepCounter.js';
