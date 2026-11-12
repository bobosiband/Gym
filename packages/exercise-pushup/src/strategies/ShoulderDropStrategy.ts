import { PoseLandmarkIndex, type PoseLandmark, type PoseLandmarks } from '@gym/pose';

/**
 * Tunable thresholds for {@link ShoulderDropStrategy}.
 *
 * `minShoulderDropRatio` is the minimum fraction of the current
 * torso length that the shoulders must move toward the ground during
 * a rep attempt. 0.25 catches the "sitting-up arm bend" failure mode
 * (torso upright, arms bending, shoulders never translate) because
 * the shoulders never drop meaningfully relative to the hips.
 *
 * `minVisibility` guards against partial-body frames.
 */
export interface ShoulderDropStrategyOptions {
  readonly minShoulderDropRatio: number;
  readonly minVisibility: number;
}

const DEFAULTS: ShoulderDropStrategyOptions = {
  minShoulderDropRatio: 0.25,
  minVisibility: 0.6,
};

/**
 * Verifies that the shoulders actually drop toward the hips during a
 * rep. Normalised MediaPipe coordinates place `y = 0` at the top of
 * the image, so "dropping" means increasing `y`. The strategy owns
 * a small amount of state: the shoulder `y` captured when the state
 * machine last declared the user to be in the up phase, and the
 * maximum shoulder `y` observed since.
 */
export class ShoulderDropStrategy {
  private readonly options: ShoulderDropStrategyOptions;
  private upShoulderY: number | null = null;
  private upTorsoLength: number | null = null;
  private peakShoulderY: number | null = null;

  public constructor(options: Partial<ShoulderDropStrategyOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Clear the stored up-phase anchor and peak. */
  public reset(): void {
    this.upShoulderY = null;
    this.upTorsoLength = null;
    this.peakShoulderY = null;
  }

  /**
   * Record the anchor shoulder `y` and torso length for a fresh up
   * phase. The detector calls this at the start of a session and on
   * every transition into the up state.
   */
  public markUp(landmarks: PoseLandmarks): void {
    const measurement = this.measure(landmarks);
    if (measurement === null) {
      return;
    }
    this.upShoulderY = measurement.shoulderY;
    this.upTorsoLength = measurement.torsoLength;
    this.peakShoulderY = measurement.shoulderY;
  }

  /**
   * Update the running peak shoulder `y` for the current rep attempt.
   * The detector calls this on every frame while the rep is in
   * progress (down phase and anywhere in between).
   */
  public observe(landmarks: PoseLandmarks): void {
    const measurement = this.measure(landmarks);
    if (measurement === null) {
      return;
    }
    if (this.peakShoulderY === null || measurement.shoulderY > this.peakShoulderY) {
      this.peakShoulderY = measurement.shoulderY;
    }
  }

  /**
   * Returns `true` iff the observed peak shoulder drop meets the
   * configured minimum relative to the up-phase torso length. The
   * detector calls this at the candidate rep boundary (down to up).
   */
  public isDropSufficient(): boolean {
    if (
      this.upShoulderY === null ||
      this.upTorsoLength === null ||
      this.peakShoulderY === null ||
      this.upTorsoLength === 0
    ) {
      return false;
    }
    const drop = this.peakShoulderY - this.upShoulderY;
    return drop >= this.options.minShoulderDropRatio * this.upTorsoLength;
  }

  private measure(
    landmarks: PoseLandmarks
  ): { readonly shoulderY: number; readonly torsoLength: number } | null {
    const leftShoulder = this.visible(landmarks[PoseLandmarkIndex.LeftShoulder]);
    const rightShoulder = this.visible(landmarks[PoseLandmarkIndex.RightShoulder]);
    const leftHip = this.visible(landmarks[PoseLandmarkIndex.LeftHip]);
    const rightHip = this.visible(landmarks[PoseLandmarkIndex.RightHip]);
    if (leftShoulder === null || rightShoulder === null || leftHip === null || rightHip === null) {
      return null;
    }
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const torsoLength = Math.abs(hipY - shoulderY);
    return { shoulderY, torsoLength };
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
