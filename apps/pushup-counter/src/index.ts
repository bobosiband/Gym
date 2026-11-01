/**
 * Public entry point for `@gym/pushup-counter`.
 *
 * Importers see the pure counter, its landmark types, the pose
 * source interface and the React widget. Internal helpers (geometry
 * primitives, the MediaPipe adapter) are available via their files
 * for tests but not re-exported here.
 */

export { ElbowAngle } from './ElbowAngle.js';
export { PushupRepCounter } from './PushupRepCounter.js';
export type { PushupPhase, PushupRepCounterOptions } from './PushupRepCounter.js';
export { MediaPipePoseSource } from './MediaPipePoseSource.js';
export type { MediaPipePoseSourceOptions } from './MediaPipePoseSource.js';
export { PoseLandmarkIndex } from './PoseLandmark.js';
export type { PoseLandmark, PoseLandmarks } from './PoseLandmark.js';
export type { PoseFrameListener, PoseSource } from './PoseSource.js';
export { PushupCounter } from './PushupCounter.js';
export type { PushupCounterProps } from './PushupCounter.js';
