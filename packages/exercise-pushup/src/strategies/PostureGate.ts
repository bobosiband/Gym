import { PoseGeometry, PoseLandmarkIndex, type PoseLandmark, type PoseLandmarks } from '@gym/pose';

import type { PushupPositionEvaluation, PushupPositionGate } from './PushupPositionGate.js';

/**
 * Tunable thresholds for {@link PostureGate}, the side-view position
 * gate. Defaults are loosened from the strict Stage 2 rules so the
 * detector counts real reps from a camera placed roughly perpendicular
 * to the user:
 *
 *  - The torso may tilt up to 45 degrees (from a perfect plank).
 *  - The shoulder-hip-ankle angle must reach at least 135 degrees,
 *    down from 150, so a slight hip sag no longer kills the rep.
 *  - Landmark visibility floor is 0.4 so partial-side exposures or
 *    dim lighting do not reject the pose.
 *  - Ankles are optional whenever both hips are visible; the gate
 *    falls back to the shoulder-hip tilt alone in that case.
 */
export interface PostureGateOptions {
  readonly maxTorsoTiltDegrees: number;
  readonly minBodyStraightnessDegrees: number;
  readonly minVisibility: number;
}

const DEFAULTS: PostureGateOptions = {
  maxTorsoTiltDegrees: 45,
  minBodyStraightnessDegrees: 135,
  minVisibility: 0.4,
};

/**
 * Result of a side-view posture evaluation.
 *
 * `inPosition` is the boolean the state machine acts on. `reason` is
 * a short human-readable tag the UI can surface to tell the user why
 * they are being paused (missing landmarks, torso too vertical, body
 * not straight enough).
 */
export type PostureEvaluation = PushupPositionEvaluation;

/**
 * Side-view position gate for push-ups. Composed into
 * {@link CompositePushupPositionGate} when running the view-aware
 * detector; also usable directly by callers that know the camera
 * angle up front.
 *
 * Rules, with every required landmark passing the visibility floor:
 *
 *  1. The absolute angle of the shoulder-to-hip line relative to the
 *     image horizontal is at most {@link PostureGateOptions.maxTorsoTiltDegrees}.
 *  2. When both ankles are visible, the shoulder-hip-ankle angle
 *     (minimum across the two sides) is at least
 *     {@link PostureGateOptions.minBodyStraightnessDegrees}. Ankles
 *     are optional when both hips are visible; the gate still accepts
 *     the frame on the tilt check alone.
 */
export class PostureGate implements PushupPositionGate {
  private readonly options: PostureGateOptions;

  public constructor(options: Partial<PostureGateOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  public evaluate(landmarks: PoseLandmarks): PostureEvaluation {
    const leftShoulder = this.visible(landmarks[PoseLandmarkIndex.LeftShoulder]);
    const rightShoulder = this.visible(landmarks[PoseLandmarkIndex.RightShoulder]);
    const leftHip = this.visible(landmarks[PoseLandmarkIndex.LeftHip]);
    const rightHip = this.visible(landmarks[PoseLandmarkIndex.RightHip]);
    if (leftShoulder === null || rightShoulder === null || leftHip === null || rightHip === null) {
      return {
        inPosition: false,
        reason: 'shoulders or hips not visible',
        torsoTiltDegrees: null,
        bodyStraightnessDegrees: null,
      };
    }
    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const hipMid = midpoint(leftHip, rightHip);
    const dx = Math.abs(hipMid.x - shoulderMid.x);
    const dy = Math.abs(hipMid.y - shoulderMid.y);
    const torsoTiltDegrees = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (torsoTiltDegrees > this.options.maxTorsoTiltDegrees) {
      return {
        inPosition: false,
        reason: 'torso too upright',
        torsoTiltDegrees,
        bodyStraightnessDegrees: null,
      };
    }
    const leftAnkle = this.visible(landmarks[PoseLandmarkIndex.LeftAnkle]);
    const rightAnkle = this.visible(landmarks[PoseLandmarkIndex.RightAnkle]);
    if (leftAnkle === null || rightAnkle === null) {
      return {
        inPosition: true,
        torsoTiltDegrees,
        bodyStraightnessDegrees: null,
      };
    }
    const leftStraight = PoseGeometry.jointAngleDegrees(leftShoulder, leftHip, leftAnkle);
    const rightStraight = PoseGeometry.jointAngleDegrees(rightShoulder, rightHip, rightAnkle);
    const bodyStraightnessDegrees = Math.min(leftStraight, rightStraight);
    if (bodyStraightnessDegrees < this.options.minBodyStraightnessDegrees) {
      return {
        inPosition: false,
        reason: 'body not straight enough',
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
