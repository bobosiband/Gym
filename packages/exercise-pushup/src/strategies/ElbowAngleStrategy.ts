import { PoseGeometry, PoseLandmarkIndex, type PoseLandmark, type PoseLandmarks } from '@gym/pose';

/**
 * Tunable thresholds for {@link ElbowAngleStrategy}.
 *
 * The `minVisibility` floor is deliberately stricter than the
 * baseline {@link PushupRepDetector} (0.6 vs 0.5) because the strict
 * detector pairs the elbow signal with a posture gate; the cost of a
 * dropped frame is only a pause, never a miscount.
 */
export interface ElbowAngleStrategyOptions {
  readonly minVisibility: number;
}

const DEFAULTS: ElbowAngleStrategyOptions = {
  minVisibility: 0.6,
};

/**
 * Elbow reading returned by {@link ElbowAngleStrategy.evaluate}.
 *
 * `maxAngle` and `minAngle` collapse to the same value when only one
 * arm is visible. When both arms are visible, `maxAngle` is the less
 * bent arm (and gates the down transition: both arms must be below
 * the down threshold) and `minAngle` is the less extended arm (and
 * gates the up transition: both arms must be above the up threshold).
 *
 * `displayAngle` is the arithmetic mean of visible arms and is the
 * value the UI should render.
 */
export interface ElbowReading {
  readonly maxAngle: number;
  readonly minAngle: number;
  readonly displayAngle: number;
}

/**
 * Computes elbow angles for the strict push-up detector.
 *
 * When both arms clear the visibility floor, both are measured and
 * the detector sees the stricter of the two for each transition.
 * When only one arm is visible, that arm's angle is used for both
 * transitions. When neither is visible the reading is `null` and the
 * detector treats the frame as dropped.
 */
export class ElbowAngleStrategy {
  private readonly options: ElbowAngleStrategyOptions;

  public constructor(options: Partial<ElbowAngleStrategyOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  public evaluate(landmarks: PoseLandmarks): ElbowReading | null {
    const left = this.measureArm(
      landmarks,
      PoseLandmarkIndex.LeftShoulder,
      PoseLandmarkIndex.LeftElbow,
      PoseLandmarkIndex.LeftWrist
    );
    const right = this.measureArm(
      landmarks,
      PoseLandmarkIndex.RightShoulder,
      PoseLandmarkIndex.RightElbow,
      PoseLandmarkIndex.RightWrist
    );
    if (left === null && right === null) {
      return null;
    }
    if (left === null) {
      return {
        maxAngle: right as number,
        minAngle: right as number,
        displayAngle: right as number,
      };
    }
    if (right === null) {
      return { maxAngle: left, minAngle: left, displayAngle: left };
    }
    return {
      maxAngle: Math.max(left, right),
      minAngle: Math.min(left, right),
      displayAngle: (left + right) / 2,
    };
  }

  private measureArm(
    landmarks: PoseLandmarks,
    shoulderIndex: number,
    elbowIndex: number,
    wristIndex: number
  ): number | null {
    const shoulder = this.visible(landmarks[shoulderIndex]);
    const elbow = this.visible(landmarks[elbowIndex]);
    const wrist = this.visible(landmarks[wristIndex]);
    if (shoulder === null || elbow === null || wrist === null) {
      return null;
    }
    return PoseGeometry.jointAngleDegrees(shoulder, elbow, wrist);
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
