/**
 * A single 2D landmark from a pose estimator, normalised to the
 * `[0, 1]` range. `visibility` is `undefined` for estimators that do
 * not report a confidence score.
 *
 * The pushup counter only looks at a handful of upper-body joints
 * (shoulder, elbow, wrist) so landmark indices are not fixed by this
 * type; the caller supplies them through {@link PoseLandmarks}.
 */
export interface PoseLandmark {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
  readonly visibility?: number;
}

/**
 * A full frame of landmarks for one pose. The index layout matches
 * MediaPipe Pose: 11 and 12 are the left and right shoulders, 13 and
 * 14 the elbows, 15 and 16 the wrists. The pushup counter uses the
 * {@link PoseLandmarkIndex} enum rather than hard-coded numbers so
 * tests read at a glance.
 */
export type PoseLandmarks = readonly PoseLandmark[];

/**
 * MediaPipe Pose landmark indices used by the push-up counter.
 */
export enum PoseLandmarkIndex {
  LeftShoulder = 11,
  RightShoulder = 12,
  LeftElbow = 13,
  RightElbow = 14,
  LeftWrist = 15,
  RightWrist = 16,
}
