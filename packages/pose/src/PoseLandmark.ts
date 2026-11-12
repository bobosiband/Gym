/**
 * A single 2D landmark from a pose estimator, normalised to `[0, 1]`.
 *
 * `visibility` is `undefined` for estimators that do not report a
 * confidence score. Detectors should ignore any landmark where
 * `visibility` falls below their own threshold rather than trusting
 * the default.
 */
export interface PoseLandmark {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
  readonly visibility?: number;
}

/**
 * A full frame of landmarks for one pose. The index layout matches
 * MediaPipe Pose: 0 is the nose, 11 and 12 are the left and right
 * shoulders, 13 and 14 the elbows, 15 and 16 the wrists, 23 and 24
 * the hips, 25 and 26 the knees, 27 and 28 the ankles.
 */
export type PoseLandmarks = readonly PoseLandmark[];

/**
 * Named MediaPipe Pose landmark indices so detectors do not pepper
 * the code with magic numbers. {@link Nose} is used by the front-view
 * push-up strategy; the rest cover both views.
 */
export enum PoseLandmarkIndex {
  Nose = 0,
  LeftShoulder = 11,
  RightShoulder = 12,
  LeftElbow = 13,
  RightElbow = 14,
  LeftWrist = 15,
  RightWrist = 16,
  LeftHip = 23,
  RightHip = 24,
  LeftKnee = 25,
  RightKnee = 26,
  LeftAnkle = 27,
  RightAnkle = 28,
}
