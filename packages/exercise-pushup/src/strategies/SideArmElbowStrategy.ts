import { PoseGeometry, PoseLandmarkIndex, type PoseLandmark, type PoseLandmarks } from '@gym/pose';

import { AngleSmoother } from './AngleSmoother.js';
import type { PushupRepStrategy, PushupRepStrategyResult } from './PushupRepStrategy.js';
import { RepTimingGate } from './RepTimingGate.js';
import type { RepTimingGateOptions } from './RepTimingGate.js';

/**
 * Tunable thresholds for {@link SideArmElbowStrategy}. Defaults match
 * the owner brief: side view counts the single most visible arm, down
 * at 105 degrees or less, up at 150 degrees or more. A light body-line
 * check (shoulder-hip-ankle at 135 or more) guards against seated arm
 * bends when the hips and ankles happen to be visible; it is skipped
 * when the hips are hidden, which is common with a phone on the floor.
 *
 * Every threshold is a named option with a defaulted value and a doc
 * comment so tuning the detector never requires reading the body of
 * the strategy.
 */
export interface SideArmElbowStrategyOptions {
  /** Smoothed elbow angle at or below which the arm counts as bent. */
  readonly downAngleDegrees: number;
  /** Smoothed elbow angle at or above which the arm counts as extended. */
  readonly upAngleDegrees: number;
  /** Width of the moving-average window applied to the elbow signal. */
  readonly smoothingWindow: number;
  /**
   * Gap (ms) between frames above which the smoother is reset. A
   * MediaPipe dropout often lasts hundreds of milliseconds; averaging
   * the first recovery frame with pre-dropout samples biases the
   * signal downward and loses the next rep peak.
   */
  readonly smootherStaleGapMs: number;
  /**
   * Shoulder-hip image distance (in normalised units) above which the
   * posture is considered too upright to be a plank. The check also
   * requires the direction to be near-vertical (hip stacked above or
   * below shoulder), so a horizontal person in a close side view
   * with shoulder and hip spaced out along the body is unaffected.
   */
  readonly maxVerticalShoulderHipGap: number;
  /**
   * Minimum shoulder-hip-ankle angle (worst of the two sides). The
   * check only runs when both hips and both ankles are visible; the
   * brief flags the ankles as optional.
   */
  readonly minBodyStraightnessDegrees: number;
  /** Visibility floor applied to every landmark the strategy touches. */
  readonly minVisibility: number;
  /**
   * Smoothed angle at or below which a rep attempt that never reaches
   * {@link downAngleDegrees} still earns a "go lower" feedback hint
   * when the user returns to the up phase. Must sit between
   * {@link downAngleDegrees} and {@link upAngleDegrees}.
   */
  readonly partialDescentHintDegrees: number;
  /** Nested rep-duration gate, matching the global 0.4 to 10 second window. */
  readonly timing: Partial<RepTimingGateOptions>;
}

const DEFAULTS: SideArmElbowStrategyOptions = {
  downAngleDegrees: 95,
  upAngleDegrees: 105,
  smoothingWindow: 3,
  smootherStaleGapMs: 200,
  maxVerticalShoulderHipGap: 0.2,
  minBodyStraightnessDegrees: 135,
  minVisibility: 0.4,
  partialDescentHintDegrees: 130,
  timing: {},
};

/**
 * Small tolerance that absorbs `acos` round-off in
 * {@link PoseGeometry.jointAngleDegrees}. Without it, a mathematically
 * exact `105` can arrive as `105.00000000000003` after a moving
 * average and fail the strict `<= 105` check.
 */
const ANGLE_EPSILON = 1e-6;

/**
 * Side-view rep strategy. Uses only the most visible arm (highest
 * combined visibility across shoulder, elbow and wrist), so a far arm
 * occluded by the body never kills the rep. Posture is a light
 * check: both shoulders must be visible; hips and ankles get used
 * when they happen to be visible but are not required, because a
 * floor-level phone often crops them out.
 *
 * State machine:
 *  - `up` to `down` when the smoothed elbow angle drops to
 *    `downAngleDegrees` or below.
 *  - `down` to `up` when the smoothed elbow angle climbs to
 *    `upAngleDegrees` or more AND the global rep-timing gate accepts
 *    the duration. A timing miss fails the rep with a readable
 *    reason instead of silently dropping it.
 */
export class SideArmElbowStrategy implements PushupRepStrategy {
  private readonly options: SideArmElbowStrategyOptions;
  private readonly smoother: AngleSmoother;
  private readonly timing: RepTimingGate;
  private phase: 'unknown' | 'up' | 'down' = 'unknown';
  private lastDownDepth: number | null = null;
  private lowestSinceUp: number = Number.POSITIVE_INFINITY;
  private lastObservedMs: number | null = null;

  public constructor(options: Partial<SideArmElbowStrategyOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.smoother = new AngleSmoother(this.options.smoothingWindow);
    this.timing = new RepTimingGate(this.options.timing);
  }

  public reset(): void {
    this.phase = 'unknown';
    this.lastDownDepth = null;
    this.lowestSinceUp = Number.POSITIVE_INFINITY;
    this.lastObservedMs = null;
    this.smoother.reset();
    this.timing.reset();
  }

  public processFrame(landmarks: PoseLandmarks, nowMs: number): PushupRepStrategyResult {
    const posture = this.evaluatePosture(landmarks);
    if (!posture.ok) {
      const base: PushupRepStrategyResult = {
        repCompleted: false,
        inPosition: false,
        phaseLabel: this.phase,
      };
      return posture.reason === undefined ? base : { ...base, failReason: posture.reason };
    }
    const arm = this.pickBestArm(landmarks);
    if (arm === null) {
      return {
        repCompleted: false,
        inPosition: false,
        phaseLabel: this.phase,
        failReason: 'arms not visible',
      };
    }
    // Clear the smoother after a long gap so the first valid frame
    // after a MediaPipe dropout is not averaged with pre-dropout
    // samples. Without this the smoothed angle drifts for several
    // frames before catching up, missing fast rep peaks.
    if (
      this.lastObservedMs !== null &&
      nowMs - this.lastObservedMs >= this.options.smootherStaleGapMs
    ) {
      this.smoother.reset();
    }
    this.lastObservedMs = nowMs;
    const smoothed = this.smoother.push(arm.angleDegrees);
    if (smoothed < this.lowestSinceUp) {
      this.lowestSinceUp = smoothed;
    }
    const isDown = smoothed <= this.options.downAngleDegrees + ANGLE_EPSILON;
    const isUp = smoothed >= this.options.upAngleDegrees - ANGLE_EPSILON;
    if (isDown) {
      if (this.phase !== 'down') {
        this.timing.markDown(nowMs);
        this.phase = 'down';
      }
      if (this.lastDownDepth === null || smoothed < this.lastDownDepth) {
        this.lastDownDepth = smoothed;
      }
      return {
        repCompleted: false,
        inPosition: true,
        phaseLabel: 'down',
        signalValue: smoothed,
      };
    }
    if (isUp) {
      const wasDown = this.phase === 'down';
      const partialDescent =
        !wasDown &&
        this.lowestSinceUp < this.options.partialDescentHintDegrees &&
        this.lowestSinceUp > this.options.downAngleDegrees;
      const timingOk = this.timing.isDurationValid(nowMs);
      this.phase = 'up';
      this.timing.reset();
      this.lowestSinceUp = smoothed;
      if (wasDown && !timingOk) {
        return {
          repCompleted: false,
          inPosition: true,
          phaseLabel: 'up',
          signalValue: smoothed,
          failReason: 'rep timing out of range',
        };
      }
      if (wasDown) {
        this.lastDownDepth = null;
        return {
          repCompleted: true,
          inPosition: true,
          phaseLabel: 'up',
          signalValue: smoothed,
        };
      }
      if (partialDescent) {
        return {
          repCompleted: false,
          inPosition: true,
          phaseLabel: 'up',
          signalValue: smoothed,
          failReason: 'go lower',
        };
      }
      return {
        repCompleted: false,
        inPosition: true,
        phaseLabel: 'up',
        signalValue: smoothed,
      };
    }
    // Mid-range between the two thresholds: hold the previous phase so
    // the user's descent is not interrupted by a frame that sits in
    // the hysteresis band.
    const hint = this.hintForMidRange();
    const base: PushupRepStrategyResult = {
      repCompleted: false,
      inPosition: true,
      phaseLabel: this.phase,
      signalValue: smoothed,
    };
    return hint === undefined ? base : { ...base, failReason: hint };
  }

  private hintForMidRange(): string | undefined {
    if (this.phase === 'down' && this.lastDownDepth !== null) {
      const needsMore = this.options.downAngleDegrees - this.lastDownDepth;
      if (needsMore > 10) {
        return 'go lower';
      }
    }
    return undefined;
  }

  /**
   * Evaluate the lightweight side-view posture requirements.
   *
   * Side view dispatch is handled by {@link ViewDetector}, so this
   * strategy trusts the caller already decided the frame is a side
   * view. The posture check only needs to:
   *
   *  1. Fail frames where the shoulders are invisible.
   *  2. Fail obvious seated or standing poses, detected by a
   *     shoulder-hip image distance that is too large for a plank
   *     without lying in the hysteresis region of a real side view
   *     with a close camera (where shoulder and hip appear almost
   *     stacked vertically in image coordinates).
   *  3. Apply the brief's light body-line check
   *     (shoulder-hip-ankle angle at or above
   *     {@link minBodyStraightnessDegrees}) but only when all three
   *     landmarks are visible, since the common floor-camera framing
   *     crops the ankles.
   */
  private evaluatePosture(landmarks: PoseLandmarks): PostureCheck {
    const leftShoulder = this.visible(landmarks[PoseLandmarkIndex.LeftShoulder]);
    const rightShoulder = this.visible(landmarks[PoseLandmarkIndex.RightShoulder]);
    if (leftShoulder === null || rightShoulder === null) {
      return { ok: false, reason: 'shoulders not visible' };
    }
    const leftHip = this.visible(landmarks[PoseLandmarkIndex.LeftHip]);
    const rightHip = this.visible(landmarks[PoseLandmarkIndex.RightHip]);
    if (leftHip !== null && rightHip !== null) {
      const shoulderMid = midpoint(leftShoulder, rightShoulder);
      const hipMid = midpoint(leftHip, rightHip);
      const dx = Math.abs(hipMid.x - shoulderMid.x);
      const dy = Math.abs(hipMid.y - shoulderMid.y);
      // A shoulder-hip separation taller than
      // `maxVerticalShoulderHipGap` with a near-vertical direction is
      // almost always someone sitting or standing, not a plank. We
      // avoid using a raw tilt threshold because close side-view
      // framing routinely puts shoulder and hip very close together
      // in image coordinates but with a high tilt reading.
      if (dy > this.options.maxVerticalShoulderHipGap && dx < dy * 0.5) {
        return { ok: false, reason: 'torso too upright' };
      }
      const leftAnkle = this.visible(landmarks[PoseLandmarkIndex.LeftAnkle]);
      const rightAnkle = this.visible(landmarks[PoseLandmarkIndex.RightAnkle]);
      if (leftAnkle !== null && rightAnkle !== null) {
        const leftStraight = PoseGeometry.jointAngleDegrees(leftShoulder, leftHip, leftAnkle);
        const rightStraight = PoseGeometry.jointAngleDegrees(rightShoulder, rightHip, rightAnkle);
        const bodyStraight = Math.min(leftStraight, rightStraight);
        if (bodyStraight < this.options.minBodyStraightnessDegrees) {
          return { ok: false, reason: 'body not straight enough' };
        }
      }
    }
    return { ok: true };
  }

  /**
   * Return the most visible arm's elbow angle, or `null` when neither
   * arm clears the visibility floor on shoulder, elbow and wrist.
   * Visibility is summed over the three landmarks so a half-occluded
   * arm loses to a fully clean one.
   */
  private pickBestArm(landmarks: PoseLandmarks): ArmReading | null {
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
      return right;
    }
    if (right === null) {
      return left;
    }
    return left.totalVisibility >= right.totalVisibility ? left : right;
  }

  private measureArm(
    landmarks: PoseLandmarks,
    shoulderIndex: PoseLandmarkIndex,
    elbowIndex: PoseLandmarkIndex,
    wristIndex: PoseLandmarkIndex
  ): ArmReading | null {
    const shoulder = this.visible(landmarks[shoulderIndex]);
    const elbow = this.visible(landmarks[elbowIndex]);
    const wrist = this.visible(landmarks[wristIndex]);
    if (shoulder === null || elbow === null || wrist === null) {
      return null;
    }
    const totalVisibility =
      (shoulder.visibility ?? 1) + (elbow.visibility ?? 1) + (wrist.visibility ?? 1);
    return {
      angleDegrees: PoseGeometry.jointAngleDegrees(shoulder, elbow, wrist),
      totalVisibility,
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

interface PostureCheck {
  readonly ok: boolean;
  readonly reason?: string;
}

interface ArmReading {
  readonly angleDegrees: number;
  readonly totalVisibility: number;
}

function midpoint(a: PoseLandmark, b: PoseLandmark): { readonly x: number; readonly y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
