import { PoseLandmarkIndex, type PoseLandmark, type PoseLandmarks } from '@gym/pose';

import { AngleSmoother } from './AngleSmoother.js';
import type { PushupRepStrategy, PushupRepStrategyResult } from './PushupRepStrategy.js';
import { RepTimingGate } from './RepTimingGate.js';
import type { RepTimingGateOptions } from './RepTimingGate.js';

/**
 * Tunable thresholds for {@link FrontShoulderSignalStrategy}.
 *
 * Elbow angle is intentionally ignored: foreshortening from the front
 * squashes every elbow into the mid-range and would never let the
 * state machine enter the down phase. The two signals we trust
 * instead are the mid-shoulder y (how far the shoulders drop toward
 * the camera) and the shoulder width (how much the chest grows as it
 * closes on the camera).
 *
 * Calibration is continuous:
 *
 *  - The "top" anchor (smallest y, smallest width) is the minimum of
 *    the last {@link calibrationMs} milliseconds of samples. This
 *    adapts to the user walking into position or shifting the phone.
 *  - The "bottom" anchor (largest y, largest width) is the running
 *    maximum across the session. It gets its first value from the
 *    deepest point of the first rep and continues to update if the
 *    user goes deeper later in the set.
 *
 * Rep detection uses whichever is more lenient: a ratio of the
 * learned range, or an absolute fraction of the baseline shoulder
 * width. The absolute rule bootstraps the first rep before a peak
 * exists; the ratio rule takes over once the user has shown us one
 * full depth.
 */
export interface FrontShoulderSignalStrategyOptions {
  /**
   * Fraction of the learned range the mid-shoulder has to travel
   * downward to enter the down phase.
   */
  readonly downEnterDepth: number;
  /** Fraction of the learned range at or below which the rep closes. */
  readonly upExitDepth: number;
  /**
   * Absolute descent (in multiples of baseline shoulder width) that
   * triggers the down phase before a peak is known. Keeps the first
   * rep reliable without a learned range.
   */
  readonly downEnterAbsoluteWidthRatio: number;
  /** Absolute return threshold used for the first rep, as above. */
  readonly upExitAbsoluteWidthRatio: number;
  /**
   * Minimum shoulder-width growth fraction (of baseline width) during
   * the descent. Rejects bending the arms without the torso actually
   * moving toward the camera.
   */
  readonly widthGrowthConfirmRatio: number;
  /**
   * The width growth has to be at least this fraction of the depth
   * growth (both measured in baseline shoulder widths). Keeps the
   * two signals coupled: a tiny arm-only bend might clear the
   * absolute width check during a coincidental twitch, but the ratio
   * prevents the descent signal from running away without width
   * following.
   */
  readonly widthDepthRatio: number;
  /** Width of the moving-average window applied to y and width. */
  readonly smoothingWindow: number;
  /** Rolling window (ms) used to compute the "top" baseline. */
  readonly calibrationMs: number;
  /** Visibility floor applied to every landmark the strategy touches. */
  readonly minVisibility: number;
  /** Minimum shoulder width (in normalised image units) for the frame to count. */
  readonly minShoulderWidth: number;
  /** Nested rep-duration gate, matching the global 0.4 to 10 second window. */
  readonly timing: Partial<RepTimingGateOptions>;
}

const DEFAULTS: FrontShoulderSignalStrategyOptions = {
  downEnterDepth: 0.6,
  upExitDepth: 0.25,
  downEnterAbsoluteWidthRatio: 0.25,
  upExitAbsoluteWidthRatio: 0.1,
  widthGrowthConfirmRatio: 0.04,
  widthDepthRatio: 0.33,
  smoothingWindow: 5,
  calibrationMs: 3000,
  minVisibility: 0.4,
  minShoulderWidth: 0.05,
  timing: {},
};

/**
 * Front-view rep strategy. Treats the mid-shoulder y and the
 * shoulder-width as the two rep signals and refuses to count a rep
 * unless both agree. See {@link FrontShoulderSignalStrategyOptions}
 * for the full rationale.
 */
export class FrontShoulderSignalStrategy implements PushupRepStrategy {
  private readonly options: FrontShoulderSignalStrategyOptions;
  private readonly ySmoother: AngleSmoother;
  private readonly widthSmoother: AngleSmoother;
  private readonly timing: RepTimingGate;
  private readonly recentY: Sample[] = [];
  private readonly recentWidth: Sample[] = [];
  private peakY: number | null = null;
  private peakWidth: number | null = null;
  private phase: 'unknown' | 'up' | 'down' = 'unknown';
  private deepestDepthRatio: number = 0;

  public constructor(options: Partial<FrontShoulderSignalStrategyOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.ySmoother = new AngleSmoother(this.options.smoothingWindow);
    this.widthSmoother = new AngleSmoother(this.options.smoothingWindow);
    this.timing = new RepTimingGate(this.options.timing);
  }

  public reset(): void {
    this.ySmoother.reset();
    this.widthSmoother.reset();
    this.timing.reset();
    this.recentY.length = 0;
    this.recentWidth.length = 0;
    this.peakY = null;
    this.peakWidth = null;
    this.phase = 'unknown';
    this.deepestDepthRatio = 0;
  }

  public processFrame(landmarks: PoseLandmarks, nowMs: number): PushupRepStrategyResult {
    const measurement = this.measure(landmarks);
    if (measurement === null) {
      return {
        repCompleted: false,
        inPosition: false,
        phaseLabel: this.phase,
        failReason: 'face or shoulders not visible',
      };
    }
    const y = this.ySmoother.push(measurement.y);
    const width = this.widthSmoother.push(measurement.width);
    this.recordRecent(this.recentY, nowMs, y);
    this.recordRecent(this.recentWidth, nowMs, width);
    const baselineY = min(this.recentY);
    const baselineWidth = min(this.recentWidth);
    if (baselineY === null || baselineWidth === null || baselineWidth === 0) {
      return {
        repCompleted: false,
        inPosition: true,
        phaseLabel: this.phase,
      };
    }
    const depthRaw = y - baselineY;
    const widthGrowth = width - baselineWidth;
    const depthAsWidths = depthRaw / baselineWidth;
    const widthAsWidths = widthGrowth / baselineWidth;
    const downAbs = this.options.downEnterAbsoluteWidthRatio;
    const upAbs = this.options.upExitAbsoluteWidthRatio;
    const depthRatio = this.rangeDepth(y, baselineY);
    const widthOkGrowth = widthAsWidths >= this.options.widthGrowthConfirmRatio;
    const widthOkCoupling = widthAsWidths >= this.options.widthDepthRatio * depthAsWidths;
    const widthOk = widthOkGrowth && widthOkCoupling;
    const depthDown =
      depthAsWidths >= downAbs ||
      (this.peakY !== null && depthRatio >= this.options.downEnterDepth);
    const depthUp =
      depthAsWidths <= upAbs || (this.peakY !== null && depthRatio <= this.options.upExitDepth);

    if (depthDown && widthOk) {
      if (this.phase !== 'down') {
        this.timing.markDown(nowMs);
        this.phase = 'down';
        this.deepestDepthRatio = 0;
      }
      this.peakY = this.peakY === null ? y : Math.max(this.peakY, y);
      this.peakWidth = this.peakWidth === null ? width : Math.max(this.peakWidth, width);
      this.deepestDepthRatio = Math.max(this.deepestDepthRatio, depthAsWidths);
      return {
        repCompleted: false,
        inPosition: true,
        phaseLabel: 'down',
        signalValue: depthAsWidths,
      };
    }

    if (depthUp) {
      const wasDown = this.phase === 'down';
      const timingOk = this.timing.isDurationValid(nowMs);
      this.phase = 'up';
      this.timing.reset();
      if (wasDown && !timingOk) {
        return {
          repCompleted: false,
          inPosition: true,
          phaseLabel: 'up',
          signalValue: depthAsWidths,
          failReason: 'rep timing out of range',
        };
      }
      if (wasDown) {
        this.deepestDepthRatio = 0;
        return {
          repCompleted: true,
          inPosition: true,
          phaseLabel: 'up',
          signalValue: depthAsWidths,
        };
      }
      return {
        repCompleted: false,
        inPosition: true,
        phaseLabel: 'up',
        signalValue: depthAsWidths,
      };
    }

    // Hysteresis band. If we saw partial descent but gave up on the
    // way down, surface a hint so the user knows what to fix.
    const hint = this.hintForHysteresis(depthAsWidths);
    const base: PushupRepStrategyResult = {
      repCompleted: false,
      inPosition: true,
      phaseLabel: this.phase,
      signalValue: depthAsWidths,
    };
    return hint === undefined ? base : { ...base, failReason: hint };
  }

  private rangeDepth(y: number, baselineY: number): number {
    if (this.peakY === null) {
      return 0;
    }
    const range = this.peakY - baselineY;
    if (range <= 0) {
      return 0;
    }
    return (y - baselineY) / range;
  }

  private hintForHysteresis(depthAsWidths: number): string | undefined {
    if (this.phase === 'down' && depthAsWidths < this.options.downEnterAbsoluteWidthRatio) {
      return 'go lower';
    }
    if (
      this.phase === 'up' &&
      this.deepestDepthRatio > 0 &&
      depthAsWidths > this.options.upExitAbsoluteWidthRatio
    ) {
      return 'lock out at the top';
    }
    return undefined;
  }

  private recordRecent(buffer: Sample[], nowMs: number, value: number): void {
    buffer.push({ ms: nowMs, value });
    const cutoff = nowMs - this.options.calibrationMs;
    while (buffer.length > 0) {
      const head = buffer[0];
      if (head === undefined || head.ms >= cutoff) {
        break;
      }
      buffer.shift();
    }
  }

  private measure(landmarks: PoseLandmarks): Measurement | null {
    const leftShoulder = this.visible(landmarks[PoseLandmarkIndex.LeftShoulder]);
    const rightShoulder = this.visible(landmarks[PoseLandmarkIndex.RightShoulder]);
    if (leftShoulder === null || rightShoulder === null) {
      return null;
    }
    const width = Math.abs(leftShoulder.x - rightShoulder.x);
    if (width < this.options.minShoulderWidth) {
      return null;
    }
    const y = (leftShoulder.y + rightShoulder.y) / 2;
    return { y, width };
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

interface Sample {
  readonly ms: number;
  readonly value: number;
}

interface Measurement {
  readonly y: number;
  readonly width: number;
}

function min(buffer: ReadonlyArray<Sample>): number | null {
  if (buffer.length === 0) {
    return null;
  }
  let smallest = Number.POSITIVE_INFINITY;
  for (const sample of buffer) {
    if (sample.value < smallest) {
      smallest = sample.value;
    }
  }
  return smallest;
}
