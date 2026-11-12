import { PoseLandmarkIndex, type PoseLandmark, type PoseLandmarks } from '@gym/pose';

import type { DescentStrategy } from './DescentStrategy.js';

/**
 * Tunable thresholds for {@link FrontDescentStrategy}.
 *
 * `minDescentRatio` is the minimum fraction of the baseline shoulder
 * width that the head (shoulder midpoint plus nose average) must
 * travel downward during a rep attempt. 0.25 is the lenient default
 * the owner brief specifies; raise it to tighten the check.
 *
 * `minVisibility` guards against partial frames. The strategy only
 * needs nose and both shoulders to anchor; wrists are nice to have
 * but the descent measurement does not depend on them.
 */
export interface FrontDescentStrategyOptions {
  readonly minDescentRatio: number;
  readonly minVisibility: number;
}

const DEFAULTS: FrontDescentStrategyOptions = {
  minDescentRatio: 0.25,
  minVisibility: 0.4,
};

/**
 * Front-view descent strategy. Normalised MediaPipe coordinates place
 * `y = 0` at the top of the image, so "down" means increasing `y`.
 * The strategy anchors a baseline head `y` and shoulder width at the
 * start of each up phase and watches the peak downward excursion of
 * the head toward the wrists; at the candidate rep boundary the
 * detector asks whether that descent is sufficient relative to the
 * shoulder width.
 */
export class FrontDescentStrategy implements DescentStrategy {
  private readonly options: FrontDescentStrategyOptions;
  private baselineHeadY: number | null = null;
  private baselineShoulderWidth: number | null = null;
  private peakHeadY: number | null = null;

  public constructor(options: Partial<FrontDescentStrategyOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  public reset(): void {
    this.baselineHeadY = null;
    this.baselineShoulderWidth = null;
    this.peakHeadY = null;
  }

  public markUp(landmarks: PoseLandmarks): void {
    const measurement = this.measure(landmarks);
    if (measurement === null) {
      return;
    }
    this.baselineHeadY = measurement.headY;
    this.baselineShoulderWidth = measurement.shoulderWidth;
    this.peakHeadY = measurement.headY;
  }

  public observe(landmarks: PoseLandmarks): void {
    const measurement = this.measure(landmarks);
    if (measurement === null) {
      return;
    }
    if (this.peakHeadY === null || measurement.headY > this.peakHeadY) {
      this.peakHeadY = measurement.headY;
    }
  }

  public isDescentSufficient(): boolean {
    if (
      this.baselineHeadY === null ||
      this.baselineShoulderWidth === null ||
      this.peakHeadY === null ||
      this.baselineShoulderWidth === 0
    ) {
      return false;
    }
    const drop = this.peakHeadY - this.baselineHeadY;
    return drop >= this.options.minDescentRatio * this.baselineShoulderWidth;
  }

  private measure(
    landmarks: PoseLandmarks
  ): { readonly headY: number; readonly shoulderWidth: number } | null {
    const leftShoulder = this.visible(landmarks[PoseLandmarkIndex.LeftShoulder]);
    const rightShoulder = this.visible(landmarks[PoseLandmarkIndex.RightShoulder]);
    if (leftShoulder === null || rightShoulder === null) {
      return null;
    }
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
    const nose = this.visible(landmarks[PoseLandmarkIndex.Nose]);
    const headY = nose === null ? shoulderMidY : (shoulderMidY + nose.y) / 2;
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    return { headY, shoulderWidth };
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
