import { PoseGeometry, PoseLandmarkIndex, type PoseLandmark, type PoseLandmarks } from '@gym/pose';

/**
 * Tunable thresholds for {@link PostureGate}. The defaults match the
 * owner brief: the torso can be up to 30 degrees off horizontal
 * (otherwise the user is sitting, kneeling, or standing) and the
 * shoulder-hip-ankle angle must stay above 150 degrees (otherwise
 * the hips sag or pike enough that the lift is not a push-up).
 */
export interface PostureGateOptions {
  readonly maxTorsoTiltDegrees: number;
  readonly minBodyStraightnessDegrees: number;
  readonly minVisibility: number;
}

const DEFAULTS: PostureGateOptions = {
  maxTorsoTiltDegrees: 30,
  minBodyStraightnessDegrees: 150,
  minVisibility: 0.6,
};

/**
 * Result of a single posture evaluation.
 *
 * `inPosition` is the boolean the state machine acts on. `reason` is
 * a short human-readable tag the UI can surface to tell the user why
 * they are being paused (missing landmarks, torso too vertical,
 * body not straight enough).
 */
export interface PostureEvaluation {
  readonly inPosition: boolean;
  readonly reason?: string;
  readonly torsoTiltDegrees: number | null;
  readonly bodyStraightnessDegrees: number | null;
}

/**
 * Decides, per frame, whether the user is in a push-up position.
 *
 * Rules (both must hold, and all required landmarks must be visible):
 *
 *  1. The absolute angle of the shoulder-to-hip line relative to the
 *     image horizontal is at most {@link PostureGateOptions.maxTorsoTiltDegrees}.
 *  2. The shoulder-hip-ankle angle (minimum across the two sides, so
 *     occluded sides never relax the check) is at least
 *     {@link PostureGateOptions.minBodyStraightnessDegrees}.
 *
 * The gate is pure: it owns no state and the detector is free to
 * evaluate it every frame.
 */
export class PostureGate {
  private readonly options: PostureGateOptions;

  public constructor(options: Partial<PostureGateOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  public evaluate(landmarks: PoseLandmarks): PostureEvaluation {
    const leftShoulder = this.visible(landmarks[PoseLandmarkIndex.LeftShoulder]);
    const rightShoulder = this.visible(landmarks[PoseLandmarkIndex.RightShoulder]);
    const leftHip = this.visible(landmarks[PoseLandmarkIndex.LeftHip]);
    const rightHip = this.visible(landmarks[PoseLandmarkIndex.RightHip]);
    const leftAnkle = this.visible(landmarks[PoseLandmarkIndex.LeftAnkle]);
    const rightAnkle = this.visible(landmarks[PoseLandmarkIndex.RightAnkle]);
    if (
      leftShoulder === null ||
      rightShoulder === null ||
      leftHip === null ||
      rightHip === null ||
      leftAnkle === null ||
      rightAnkle === null
    ) {
      return {
        inPosition: false,
        reason: 'Full-body landmarks are not visible',
        torsoTiltDegrees: null,
        bodyStraightnessDegrees: null,
      };
    }
    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const hipMid = midpoint(leftHip, rightHip);
    const dx = Math.abs(hipMid.x - shoulderMid.x);
    const dy = Math.abs(hipMid.y - shoulderMid.y);
    const torsoTiltDegrees = (Math.atan2(dy, dx) * 180) / Math.PI;
    const leftStraight = PoseGeometry.jointAngleDegrees(leftShoulder, leftHip, leftAnkle);
    const rightStraight = PoseGeometry.jointAngleDegrees(rightShoulder, rightHip, rightAnkle);
    const bodyStraightnessDegrees = Math.min(leftStraight, rightStraight);
    if (torsoTiltDegrees > this.options.maxTorsoTiltDegrees) {
      return {
        inPosition: false,
        reason: 'Torso is too upright',
        torsoTiltDegrees,
        bodyStraightnessDegrees,
      };
    }
    if (bodyStraightnessDegrees < this.options.minBodyStraightnessDegrees) {
      return {
        inPosition: false,
        reason: 'Body is not straight enough',
        torsoTiltDegrees,
        bodyStraightnessDegrees,
      };
    }
    return {
      inPosition: true,
      torsoTiltDegrees,
      bodyStraightnessDegrees,
    };
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

function midpoint(a: PoseLandmark, b: PoseLandmark): { readonly x: number; readonly y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
