import { PoseLandmarkIndex, type PoseLandmark, type PoseLandmarks } from '@gym/pose';

import type { PushupViewKind } from './PushupViewKind.js';

/**
 * Tunable thresholds for {@link ViewDetector}. The defaults match the
 * owner brief: shoulder-hip tilt is the primary signal (close to
 * vertical means the camera faces the user, close to horizontal means
 * the camera is on the side); shoulder-width vs shoulder-to-wrist
 * distance is the fallback when hips are not visible. `confirmFrames`
 * is the hysteresis window so a single rogue frame does not flip the
 * view.
 */
export interface ViewDetectorOptions {
  /** Tilt at or above which the view flips to front. */
  readonly frontTiltDegrees: number;
  /** Tilt at or below which the view flips to side. */
  readonly sideTiltDegrees: number;
  /** Fallback shoulder-width ratio at or above which the view flips to front. */
  readonly frontRatio: number;
  /** Fallback shoulder-width ratio at or below which the view flips to side. */
  readonly sideRatio: number;
  /** Number of consecutive agreeing frames required to flip the current view. */
  readonly confirmFrames: number;
  /** Visibility floor for landmarks the detector relies on. */
  readonly minVisibility: number;
}

const DEFAULTS: ViewDetectorOptions = {
  frontTiltDegrees: 45,
  sideTiltDegrees: 30,
  frontRatio: 0.7,
  sideRatio: 0.4,
  confirmFrames: 3,
  minVisibility: 0.4,
};

/**
 * Classifies the camera angle from a single pose frame and smooths
 * the output with a short hysteresis window so transient misreads do
 * not flicker the UI or cause the position gate to swap mid-rep.
 */
export class ViewDetector {
  private readonly options: ViewDetectorOptions;
  private current: PushupViewKind = 'unknown';
  private candidate: PushupViewKind = 'unknown';
  private candidateStreak: number = 0;

  public constructor(options: Partial<ViewDetectorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Return the smoothed view without re-observing a frame. */
  public getView(): PushupViewKind {
    return this.current;
  }

  /** Clear the detector; next `observe` starts from `unknown`. */
  public reset(): void {
    this.current = 'unknown';
    this.candidate = 'unknown';
    this.candidateStreak = 0;
  }

  /**
   * Classify one frame and return the smoothed view.
   *
   * A reading flips the current view only after `confirmFrames`
   * consecutive frames agree on it; this keeps the view stable
   * through a single-frame dropout or misread.
   */
  public observe(landmarks: PoseLandmarks): PushupViewKind {
    const reading = this.classify(landmarks);
    if (reading === 'unknown') {
      this.candidate = 'unknown';
      this.candidateStreak = 0;
      return this.current;
    }
    if (reading === this.current) {
      this.candidate = 'unknown';
      this.candidateStreak = 0;
      return this.current;
    }
    if (reading === this.candidate) {
      this.candidateStreak += 1;
    } else {
      this.candidate = reading;
      this.candidateStreak = 1;
    }
    if (this.candidateStreak >= this.options.confirmFrames) {
      this.current = reading;
      this.candidate = 'unknown';
      this.candidateStreak = 0;
    }
    return this.current;
  }

  private classify(landmarks: PoseLandmarks): PushupViewKind {
    const leftShoulder = this.visible(landmarks[PoseLandmarkIndex.LeftShoulder]);
    const rightShoulder = this.visible(landmarks[PoseLandmarkIndex.RightShoulder]);
    if (leftShoulder === null || rightShoulder === null) {
      return 'unknown';
    }
    const leftHip = this.visible(landmarks[PoseLandmarkIndex.LeftHip]);
    const rightHip = this.visible(landmarks[PoseLandmarkIndex.RightHip]);
    if (leftHip !== null && rightHip !== null) {
      const shoulderMid = midpoint(leftShoulder, rightShoulder);
      const hipMid = midpoint(leftHip, rightHip);
      const dx = Math.abs(hipMid.x - shoulderMid.x);
      const dy = Math.abs(hipMid.y - shoulderMid.y);
      const tiltDegrees = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (tiltDegrees >= this.options.frontTiltDegrees) {
        return 'front';
      }
      if (tiltDegrees <= this.options.sideTiltDegrees) {
        return 'side';
      }
      return 'unknown';
    }
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    const leftWrist = this.visible(landmarks[PoseLandmarkIndex.LeftWrist]);
    const rightWrist = this.visible(landmarks[PoseLandmarkIndex.RightWrist]);
    const wrist = leftWrist ?? rightWrist;
    const shoulder = leftWrist !== null ? leftShoulder : rightShoulder;
    if (wrist === null || shoulderWidth === 0) {
      return 'unknown';
    }
    const armReach = Math.hypot(wrist.x - shoulder.x, wrist.y - shoulder.y);
    if (armReach === 0) {
      return 'unknown';
    }
    const ratio = shoulderWidth / armReach;
    if (ratio >= this.options.frontRatio) {
      return 'front';
    }
    if (ratio <= this.options.sideRatio) {
      return 'side';
    }
    return 'unknown';
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
