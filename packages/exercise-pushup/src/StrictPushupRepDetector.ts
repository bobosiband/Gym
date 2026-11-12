import type { PoseLandmarks, RepDetector, RepObservation } from '@gym/pose';

import { AngleSmoother } from './strategies/AngleSmoother.js';
import { CompositeDescentStrategy } from './strategies/CompositeDescentStrategy.js';
import { CompositePushupPositionGate } from './strategies/CompositePushupPositionGate.js';
import { DropoutTolerance } from './strategies/DropoutTolerance.js';
import type { DropoutToleranceOptions } from './strategies/DropoutTolerance.js';
import { ElbowAngleStrategy } from './strategies/ElbowAngleStrategy.js';
import type { ElbowAngleStrategyOptions } from './strategies/ElbowAngleStrategy.js';
import { FrontDescentStrategy } from './strategies/FrontDescentStrategy.js';
import type { FrontDescentStrategyOptions } from './strategies/FrontDescentStrategy.js';
import { FrontPostureGate } from './strategies/FrontPostureGate.js';
import type { FrontPostureGateOptions } from './strategies/FrontPostureGate.js';
import { PostureGate } from './strategies/PostureGate.js';
import type { PostureGateOptions } from './strategies/PostureGate.js';
import type { PushupViewKind } from './strategies/PushupViewKind.js';
import { RepTimingGate } from './strategies/RepTimingGate.js';
import type { RepTimingGateOptions } from './strategies/RepTimingGate.js';
import { ShoulderDropStrategy } from './strategies/ShoulderDropStrategy.js';
import type { ShoulderDropStrategyOptions } from './strategies/ShoulderDropStrategy.js';
import { ViewDetector } from './strategies/ViewDetector.js';
import type { ViewDetectorOptions } from './strategies/ViewDetector.js';

/**
 * Phase label the detector reports back through
 * {@link RepObservation.phaseLabel}. `pause` signals that posture has
 * lapsed long enough that reps are not being counted; `dropout`
 * covers a brief landmark miss where the previous phase is held but
 * no decision happens this frame.
 */
export type StrictPushupPhase = 'unknown' | 'up' | 'down' | 'pause' | 'dropout';

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
  /**
   * Milliseconds the detector spends refining the up-phase baseline
   * after the user enters position. The baseline updates on every
   * up-phase frame inside this window so a single-frame snapshot does
   * not anchor the descent threshold too optimistically.
   */
  readonly calibrationMs: number;
  /** Overrides passed through to {@link PostureGate} (side view). */
  readonly posture: Partial<PostureGateOptions>;
  /** Overrides passed through to {@link FrontPostureGate}. */
  readonly frontPosture: Partial<FrontPostureGateOptions>;
  /** Overrides passed through to {@link ViewDetector}. */
  readonly view: Partial<ViewDetectorOptions>;
  /** Overrides passed through to {@link DropoutTolerance}. */
  readonly dropout: Partial<DropoutToleranceOptions>;
  /** Overrides passed through to {@link ElbowAngleStrategy}. */
  readonly elbow: Partial<ElbowAngleStrategyOptions>;
  /** Overrides passed through to {@link ShoulderDropStrategy} (side view). */
  readonly shoulderDrop: Partial<ShoulderDropStrategyOptions>;
  /** Overrides passed through to {@link FrontDescentStrategy}. */
  readonly frontDescent: Partial<FrontDescentStrategyOptions>;
  /** Overrides passed through to {@link RepTimingGate}. */
  readonly timing: Partial<RepTimingGateOptions>;
  /** Clock used for rep-timing. Injected so tests can run on a fake clock. */
  readonly now: () => number;
}

/**
 * Small comparison tolerance that absorbs `acos` round-off in
 * {@link PoseGeometry.jointAngleDegrees}. Without it, a mathematically
 * exact `90` can arrive as `90.00000000000003` after a moving
 * average and fail the strict `<= 90` down check.
 */
const ANGLE_EPSILON = 1e-6;

const DEFAULTS: StrictPushupRepDetectorOptions = {
  downAngleDegrees: 90,
  upAngleDegrees: 160,
  smoothingWindow: 5,
  calibrationMs: 1500,
  posture: {},
  frontPosture: {},
  view: {},
  dropout: {},
  elbow: {},
  shoulderDrop: {},
  frontDescent: {},
  timing: {},
  now: () => Date.now(),
};

/**
 * Push-up rep detector that works from both FRONT and SIDE camera
 * views. Composes the per-view position gates and descent strategies
 * behind {@link CompositePushupPositionGate} and
 * {@link CompositeDescentStrategy}, with a shared {@link ViewDetector}
 * picking which strategy answers at a given moment.
 *
 * A rep is counted only when every rule holds:
 *
 *  1. The user is in a push-up posture for the active view (side:
 *     shoulder-hip line within 45 degrees of horizontal, body
 *     straight through the ankles when ankles are visible; front:
 *     face, shoulders, and at least one arm visible with wrists
 *     below shoulders).
 *  2. Both elbows (or the single visible elbow) cross the smoothed
 *     down threshold during the down phase.
 *  3. Both elbows (or the single visible elbow) cross the smoothed
 *     up threshold at the candidate rep boundary.
 *  4. The per-view descent is sufficient: side view requires the
 *     shoulders to drop at least 25 percent of the torso length;
 *     front view requires the head to drop at least 25 percent of
 *     the shoulder width toward the wrists.
 *  5. The elapsed time from down-entry to up-exit falls inside the
 *     configured `[minRepSeconds, maxRepSeconds]` window.
 *
 * Posture misses are absorbed by {@link DropoutTolerance} up to the
 * configured number of frames (roughly 200 ms at 30 fps); only a
 * longer lapse moves the state machine into `pause` and resets the
 * descent, timing, and smoother. The up-phase baseline auto-calibrates
 * across `calibrationMs` so the user's first stable up pose anchors
 * the descent threshold rather than a single noisy frame.
 */
export class StrictPushupRepDetector implements RepDetector {
  private readonly options: StrictPushupRepDetectorOptions;
  private readonly viewDetector: ViewDetector;
  private readonly positionGate: CompositePushupPositionGate;
  private readonly elbowStrategy: ElbowAngleStrategy;
  private readonly descent: CompositeDescentStrategy;
  private readonly dropout: DropoutTolerance;
  private readonly timing: RepTimingGate;
  private readonly maxSmoother: AngleSmoother;
  private readonly minSmoother: AngleSmoother;
  private phase: StrictPushupPhase = 'unknown';
  private upEnteredAtMs: number | null = null;

  public constructor(options: Partial<StrictPushupRepDetectorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.viewDetector = new ViewDetector(this.options.view);
    this.positionGate = new CompositePushupPositionGate({
      viewDetector: this.viewDetector,
      frontGate: new FrontPostureGate(this.options.frontPosture),
      sideGate: new PostureGate(this.options.posture),
    });
    this.elbowStrategy = new ElbowAngleStrategy(this.options.elbow);
    this.descent = new CompositeDescentStrategy({
      viewDetector: this.viewDetector,
      frontStrategy: new FrontDescentStrategy(this.options.frontDescent),
      sideStrategy: new ShoulderDropStrategy(this.options.shoulderDrop),
    });
    this.dropout = new DropoutTolerance(this.options.dropout);
    this.timing = new RepTimingGate(this.options.timing);
    this.maxSmoother = new AngleSmoother(this.options.smoothingWindow);
    this.minSmoother = new AngleSmoother(this.options.smoothingWindow);
  }

  public reset(): void {
    this.phase = 'unknown';
    this.upEnteredAtMs = null;
    this.viewDetector.reset();
    this.descent.reset();
    this.timing.reset();
    this.maxSmoother.reset();
    this.minSmoother.reset();
    this.dropout.reset();
  }

  public processFrame(landmarks: PoseLandmarks): RepObservation {
    const posture = this.positionGate.evaluate(landmarks);
    const view = posture.view ?? 'unknown';
    if (!posture.inPosition) {
      const exceeded = this.dropout.observeMiss();
      if (!exceeded && this.phase !== 'unknown' && this.phase !== 'pause') {
        return withFailReason({ repCompleted: false, phaseLabel: 'dropout', view }, posture.reason);
      }
      if (this.phase !== 'pause') {
        this.descent.reset();
        this.timing.reset();
        this.maxSmoother.reset();
        this.minSmoother.reset();
        this.upEnteredAtMs = null;
      }
      this.phase = 'pause';
      return withFailReason({ repCompleted: false, phaseLabel: 'pause', view }, posture.reason);
    }
    this.dropout.observeOk();
    const reading = this.elbowStrategy.evaluate(landmarks);
    if (reading === null) {
      return {
        repCompleted: false,
        phaseLabel: this.phase,
        view,
        failReason: 'arms not visible',
      };
    }
    const smoothedMax = this.maxSmoother.push(reading.maxAngle);
    const smoothedMin = this.minSmoother.push(reading.minAngle);
    const isDown = smoothedMax <= this.options.downAngleDegrees + ANGLE_EPSILON;
    const isUp = smoothedMin >= this.options.upAngleDegrees - ANGLE_EPSILON;
    const nowMs = this.options.now();
    if (isDown) {
      if (this.phase !== 'down') {
        this.timing.markDown(nowMs);
        this.phase = 'down';
      }
      this.descent.observe(landmarks);
      return {
        repCompleted: false,
        phaseLabel: 'down',
        signalValue: reading.displayAngle,
        view,
      };
    }
    if (isUp) {
      const wasDown = this.phase === 'down';
      const enteringUp = this.phase !== 'up';
      const descentOk = this.descent.isDescentSufficient();
      const timingOk = this.timing.isDurationValid(nowMs);
      const completed = wasDown && descentOk && timingOk;
      if (enteringUp) {
        this.descent.markUp(landmarks);
        this.upEnteredAtMs = nowMs;
      } else if (this.isCalibrating(nowMs) && reading.maxAngle >= this.options.upAngleDegrees) {
        this.descent.markUp(landmarks);
      }
      this.phase = 'up';
      this.timing.reset();
      let failReason: string | undefined;
      if (wasDown && !completed) {
        failReason = !descentOk ? 'not low enough' : 'rep timing out of range';
      }
      return withFailReason(
        {
          repCompleted: completed,
          phaseLabel: 'up',
          signalValue: reading.displayAngle,
          view,
        },
        failReason
      );
    }
    if (this.phase === 'down') {
      this.descent.observe(landmarks);
    }
    return {
      repCompleted: false,
      phaseLabel: this.phase,
      signalValue: reading.displayAngle,
      view,
    };
  }

  private isCalibrating(nowMs: number): boolean {
    if (this.upEnteredAtMs === null) {
      return false;
    }
    return nowMs - this.upEnteredAtMs <= this.options.calibrationMs;
  }
}

/** Re-export so callers do not need to reach into `./strategies`. */
export type { PushupViewKind };

/**
 * Attach a `failReason` to the observation only when one is set. The
 * TypeScript config is `exactOptionalPropertyTypes: true`, so the
 * literal `{ failReason: undefined }` would fail against the
 * `failReason?: string` declaration in {@link RepObservation}.
 */
function withFailReason(observation: RepObservation, reason: string | undefined): RepObservation {
  if (reason === undefined) {
    return observation;
  }
  return { ...observation, failReason: reason };
}
