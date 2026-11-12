import { PoseLandmarkIndex, type PoseLandmark, type PoseLandmarks } from '@gym/pose';

import type { PushupPositionEvaluation, PushupPositionGate } from './PushupPositionGate.js';

/**
 * Tunable thresholds for {@link FrontPostureGate}. The gate is
 * deliberately lenient: in a front-facing camera the user's hips and
 * ankles are almost always occluded by the torso, so the only
 * reliable signals are the nose, the two shoulders, and the arms.
 *
 *  - `minShoulderWidth` rejects far-away or face-only framings where
 *    the shoulders are barely distinguishable.
 *  - `minVisibility` is the landmark confidence floor shared with the
 *    rest of the lenient defaults.
 */
export interface FrontPostureGateOptions {
  readonly minShoulderWidth: number;
  readonly minVisibility: number;
}

const DEFAULTS: FrontPostureGateOptions = {
  minShoulderWidth: 0.08,
  minVisibility: 0.4,
};

/**
 * Front-view position gate. The user is "in position" when:
 *
 *  1. The nose is visible (so we are looking at a person facing the
 *     camera, not an arbitrary hand frame).
 *  2. Both shoulders are visible and at least `minShoulderWidth`
 *     apart in normalised coordinates.
 *  3. At least one arm (shoulder, elbow, and wrist all visible) has
 *     its wrist below the shoulder in the image. Both arms count if
 *     both are visible; one arm is enough otherwise (brief says
 *     count from the visible arm rather than refuse).
 *
 * Returns a short `reason` tag the UI can surface so the user knows
 * which check is blocking them.
 */
export class FrontPostureGate implements PushupPositionGate {
  private readonly options: FrontPostureGateOptions;

  public constructor(options: Partial<FrontPostureGateOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  public evaluate(landmarks: PoseLandmarks): PushupPositionEvaluation {
    const nose = this.visible(landmarks[PoseLandmarkIndex.Nose]);
    if (nose === null) {
      return { inPosition: false, reason: 'face not visible' };
    }
    const leftShoulder = this.visible(landmarks[PoseLandmarkIndex.LeftShoulder]);
    const rightShoulder = this.visible(landmarks[PoseLandmarkIndex.RightShoulder]);
    if (leftShoulder === null || rightShoulder === null) {
      return { inPosition: false, reason: 'shoulders not visible' };
    }
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    if (shoulderWidth < this.options.minShoulderWidth) {
      return { inPosition: false, reason: 'shoulders too close' };
    }
    const leftArm = this.measureArm(
      landmarks,
      leftShoulder,
      PoseLandmarkIndex.LeftElbow,
      PoseLandmarkIndex.LeftWrist
    );
    const rightArm = this.measureArm(
      landmarks,
      rightShoulder,
      PoseLandmarkIndex.RightElbow,
      PoseLandmarkIndex.RightWrist
    );
    if (leftArm === null && rightArm === null) {
      return { inPosition: false, reason: 'no arm visible' };
    }
    const arms = [leftArm, rightArm].filter((arm): arm is ArmReading => arm !== null);
    const everyWristBelow = arms.every((arm) => arm.wrist.y > arm.shoulder.y);
    if (!everyWristBelow) {
      return { inPosition: false, reason: 'wrists not below shoulders' };
    }
    return { inPosition: true };
  }

  private measureArm(
    landmarks: PoseLandmarks,
    shoulder: PoseLandmark,
    elbowIndex: PoseLandmarkIndex,
    wristIndex: PoseLandmarkIndex
  ): ArmReading | null {
    const elbow = this.visible(landmarks[elbowIndex]);
    const wrist = this.visible(landmarks[wristIndex]);
    if (elbow === null || wrist === null) {
      return null;
    }
    return { shoulder, elbow, wrist };
  }

  private visible(landmark: PoseLandmark | undefined): PoseLandmark | null {
    if (landmark === undefined) {
      return null;
    }
    const v = landmark.visibility ?? 1;
    if (v < this.options.minVisibility) {
      return null;
    }
    return landmark;
  }
}

interface ArmReading {
  readonly shoulder: PoseLandmark;
  readonly elbow: PoseLandmark;
  readonly wrist: PoseLandmark;
}
