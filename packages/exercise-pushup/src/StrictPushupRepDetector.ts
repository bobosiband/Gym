import type { PoseLandmarks, RepDetector, RepObservation } from '@gym/pose';

import { AngleSmoother } from './strategies/AngleSmoother.js';
import { ElbowAngleStrategy } from './strategies/ElbowAngleStrategy.js';
import type { ElbowAngleStrategyOptions } from './strategies/ElbowAngleStrategy.js';
import { PostureGate } from './strategies/PostureGate.js';
import type { PostureGateOptions } from './strategies/PostureGate.js';
import { RepTimingGate } from './strategies/RepTimingGate.js';
import type { RepTimingGateOptions } from './strategies/RepTimingGate.js';
import { ShoulderDropStrategy } from './strategies/ShoulderDropStrategy.js';
import type { ShoulderDropStrategyOptions } from './strategies/ShoulderDropStrategy.js';

/**
 * Phase label the strict detector reports back through
 * {@link RepObservation.phaseLabel}. `pause` is the extra value the
 * strict detector introduces over the baseline detector; it signals
 * to the UI that posture has lapsed and reps are not being counted.
 */
export type StrictPushupPhase = 'unknown' | 'up' | 'down' | 'pause';

/**
 * Tunable thresholds for {@link StrictPushupRepDetector}.
 *
 * Every threshold is named and defaulted, with the rationale captured
 * in the per-field doc comment, so tuning the detector never requires
 * re-reading the implementation. Nested strategy options are merged
 * with their own defaults.
 */
export interface StrictPushupRepDetectorOptions {
  /** Elbow angle (degrees) at or below which the arms count as bent. */
  readonly downAngleDegrees: number;
  /** Elbow angle (degrees) at or above which the arms count as extended. */
  readonly upAngleDegrees: number;
  /** Width of the moving-average filter applied to the elbow signals. */
  readonly smoothingWindow: number;
  /** Overrides passed through to {@link PostureGate}. */
  readonly posture: Partial<PostureGateOptions>;
  /** Overrides passed through to {@link ElbowAngleStrategy}. */
  readonly elbow: Partial<ElbowAngleStrategyOptions>;
  /** Overrides passed through to {@link ShoulderDropStrategy}. */
  readonly shoulderDrop: Partial<ShoulderDropStrategyOptions>;
  /** Overrides passed through to {@link RepTimingGate}. */
  readonly timing: Partial<RepTimingGateOptions>;
  /** Clock used for rep-timing. Injected so tests can run on a fake clock. */
  readonly now: () => number;
}

const DEFAULTS: StrictPushupRepDetectorOptions = {
  downAngleDegrees: 90,
  upAngleDegrees: 160,
  smoothingWindow: 5,
  posture: {},
  elbow: {},
  shoulderDrop: {},
  timing: {},
  now: () => Date.now(),
};

/**
 * Strict push-up rep detector. Composes a {@link PostureGate},
 * {@link ElbowAngleStrategy}, {@link ShoulderDropStrategy},
 * {@link AngleSmoother} pair and {@link RepTimingGate} into a single
 * state machine suitable for the generic {@link RepCounter}.
 *
 * A rep is counted only when every rule holds:
 *
 *  1. The user is in a push-up posture (shoulder-hip tilt near
 *     horizontal, body straight through the ankles).
 *  2. Both elbows (or the single visible elbow) cross the smoothed
 *     down threshold during the down phase.
 *  3. Both elbows (or the single visible elbow) cross the smoothed
 *     up threshold at the candidate rep boundary.
 *  4. The shoulders drop by at least the configured fraction of the
 *     torso length between the up anchor and the deepest point.
 *  5. The elapsed time from down-entry to up-exit falls inside the
 *     configured `[minRepSeconds, maxRepSeconds]` window.
 *
 * Posture failures move the state machine into the `pause` phase,
 * clear the shoulder-drop anchor, and emit a reason the UI can
 * display. The moving-average filter catches threshold jitter so a
 * frame or two of noise does not flip the phase.
 */
export class StrictPushupRepDetector implements RepDetector {
  private readonly options: StrictPushupRepDetectorOptions;
  private readonly postureGate: PostureGate;
  private readonly elbowStrategy: ElbowAngleStrategy;
  private readonly shoulderDrop: ShoulderDropStrategy;
  private readonly timing: RepTimingGate;
  private readonly maxSmoother: AngleSmoother;
  private readonly minSmoother: AngleSmoother;
  private phase: StrictPushupPhase = 'unknown';

  public constructor(options: Partial<StrictPushupRepDetectorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.postureGate = new PostureGate(this.options.posture);
    this.elbowStrategy = new ElbowAngleStrategy(this.options.elbow);
    this.shoulderDrop = new ShoulderDropStrategy(this.options.shoulderDrop);
    this.timing = new RepTimingGate(this.options.timing);
    this.maxSmoother = new AngleSmoother(this.options.smoothingWindow);
    this.minSmoother = new AngleSmoother(this.options.smoothingWindow);
  }

  public reset(): void {
    this.phase = 'unknown';
    this.shoulderDrop.reset();
    this.timing.reset();
    this.maxSmoother.reset();
    this.minSmoother.reset();
  }

  public processFrame(landmarks: PoseLandmarks): RepObservation {
    const posture = this.postureGate.evaluate(landmarks);
    if (!posture.inPosition) {
      if (this.phase !== 'pause') {
        this.shoulderDrop.reset();
        this.timing.reset();
        this.maxSmoother.reset();
        this.minSmoother.reset();
      }
      this.phase = 'pause';
      return { repCompleted: false, phaseLabel: 'pause' };
    }
    const reading = this.elbowStrategy.evaluate(landmarks);
    if (reading === null) {
      return { repCompleted: false, phaseLabel: this.phase };
    }
    const smoothedMax = this.maxSmoother.push(reading.maxAngle);
    const smoothedMin = this.minSmoother.push(reading.minAngle);
    const isDown = smoothedMax <= this.options.downAngleDegrees;
    const isUp = smoothedMin >= this.options.upAngleDegrees;
    const nowMs = this.options.now();
    if (isDown) {
      if (this.phase !== 'down') {
        this.timing.markDown(nowMs);
        this.phase = 'down';
      }
      this.shoulderDrop.observe(landmarks);
      return { repCompleted: false, phaseLabel: 'down', signalValue: reading.displayAngle };
    }
    if (isUp) {
      const wasDown = this.phase === 'down';
      const enteringUp = this.phase !== 'up';
      const dropOk = this.shoulderDrop.isDropSufficient();
      const timingOk = this.timing.isDurationValid(nowMs);
      const completed = wasDown && dropOk && timingOk;
      this.phase = 'up';
      if (enteringUp) {
        this.shoulderDrop.markUp(landmarks);
      }
      this.timing.reset();
      return { repCompleted: completed, phaseLabel: 'up', signalValue: reading.displayAngle };
    }
    if (this.phase === 'down') {
      this.shoulderDrop.observe(landmarks);
    }
    return { repCompleted: false, phaseLabel: this.phase, signalValue: reading.displayAngle };
  }
}
