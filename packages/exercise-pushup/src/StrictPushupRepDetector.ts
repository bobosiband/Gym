import type { PoseLandmarks, RepDetector, RepObservation } from '@gym/pose';

import { FrontShoulderSignalStrategy } from './strategies/FrontShoulderSignalStrategy.js';
import type { FrontShoulderSignalStrategyOptions } from './strategies/FrontShoulderSignalStrategy.js';
import { PostureHoldTolerance } from './strategies/PostureHoldTolerance.js';
import type { PostureHoldToleranceOptions } from './strategies/PostureHoldTolerance.js';
import type { PushupRepStrategy, PushupRepStrategyResult } from './strategies/PushupRepStrategy.js';
import type { PushupViewKind } from './strategies/PushupViewKind.js';
import { SideArmElbowStrategy } from './strategies/SideArmElbowStrategy.js';
import type { SideArmElbowStrategyOptions } from './strategies/SideArmElbowStrategy.js';
import { ViewDetector } from './strategies/ViewDetector.js';
import type { ViewDetectorOptions } from './strategies/ViewDetector.js';

/**
 * Phase label the detector reports back through
 * {@link RepObservation.phaseLabel}. `pause` signals that posture has
 * lapsed for longer than {@link PostureHoldToleranceOptions.pauseAfterMs}
 * and reps are no longer being counted; `dropout` covers a shorter
 * out-of-position wobble where the previous phase is held and the
 * in-progress rep is preserved.
 */
export type StrictPushupPhase = 'unknown' | 'up' | 'down' | 'pause' | 'dropout';

/**
 * Tunable thresholds for {@link StrictPushupRepDetector}.
 *
 * The detector is a router: it picks between {@link FrontShoulderSignalStrategy}
 * and {@link SideArmElbowStrategy} based on the live {@link ViewDetector}
 * reading. Per-strategy thresholds live under {@link front} and
 * {@link side}; shared knobs (view detection, posture hold tolerance,
 * injected clock) live at the top level.
 */
export interface StrictPushupRepDetectorOptions {
  /** Overrides passed through to the side-view rep strategy. */
  readonly side: Partial<SideArmElbowStrategyOptions>;
  /** Overrides passed through to the front-view rep strategy. */
  readonly front: Partial<FrontShoulderSignalStrategyOptions>;
  /** Overrides passed through to {@link ViewDetector}. */
  readonly view: Partial<ViewDetectorOptions>;
  /** Overrides passed through to {@link PostureHoldTolerance}. */
  readonly postureHold: Partial<PostureHoldToleranceOptions>;
  /** Clock used for rep timing and posture-hold tolerance. */
  readonly now: () => number;
}

const DEFAULTS: StrictPushupRepDetectorOptions = {
  side: {},
  front: {},
  view: {},
  postureHold: {},
  now: () => Date.now(),
};

/**
 * Push-up rep detector that works from both FRONT and SIDE camera
 * views. Picks the right rep strategy based on {@link ViewDetector}
 * and routes every frame through it; the strategy owns its own
 * state machine, calibration, and thresholds. A shared
 * {@link PostureHoldTolerance} absorbs short out-of-position wobbles
 * so a one-frame miss does not kill an in-progress rep.
 *
 * Posture failures surface as `failReason` on the observation so the
 * UI can tell the user why a rep was rejected ("go lower", "lock out
 * at the top", "get into position") instead of silently refusing to
 * count.
 */
export class StrictPushupRepDetector implements RepDetector {
  private readonly options: StrictPushupRepDetectorOptions;
  private readonly viewDetector: ViewDetector;
  private readonly frontStrategy: PushupRepStrategy;
  private readonly sideStrategy: PushupRepStrategy;
  private readonly postureHold: PostureHoldTolerance;
  private phase: StrictPushupPhase = 'unknown';

  public constructor(options: Partial<StrictPushupRepDetectorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.viewDetector = new ViewDetector(this.options.view);
    this.frontStrategy = new FrontShoulderSignalStrategy(this.options.front);
    this.sideStrategy = new SideArmElbowStrategy(this.options.side);
    this.postureHold = new PostureHoldTolerance(this.options.postureHold);
  }

  public reset(): void {
    this.phase = 'unknown';
    this.viewDetector.reset();
    this.frontStrategy.reset();
    this.sideStrategy.reset();
    this.postureHold.reset();
  }

  public processFrame(landmarks: PoseLandmarks): RepObservation {
    const view = this.viewDetector.observe(landmarks);
    const nowMs = this.options.now();
    const strategy = this.pickStrategy(view);
    const result = strategy.processFrame(landmarks, nowMs);
    if (!result.inPosition) {
      const paused = this.postureHold.observeMiss(nowMs);
      if (paused) {
        this.phase = 'pause';
        this.frontStrategy.reset();
        this.sideStrategy.reset();
        return withOptional({ repCompleted: false, phaseLabel: 'pause', view }, result);
      }
      return withOptional({ repCompleted: false, phaseLabel: 'dropout', view }, result);
    }
    this.postureHold.observeOk();
    this.phase = result.phaseLabel;
    return withOptional(
      {
        repCompleted: result.repCompleted,
        phaseLabel: result.phaseLabel,
        view,
      },
      result
    );
  }

  private pickStrategy(view: PushupViewKind): PushupRepStrategy {
    return view === 'front' ? this.frontStrategy : this.sideStrategy;
  }
}

/** Re-export so callers do not need to reach into `./strategies`. */
export type { PushupViewKind };

/**
 * Carry the optional fields from a strategy result onto the public
 * {@link RepObservation}. Done through an explicit helper because the
 * TypeScript config is `exactOptionalPropertyTypes: true`, so adding
 * `signalValue: undefined` to an observation would fail the
 * `signalValue?: number` typing on {@link RepObservation}.
 */
function withOptional(
  base: RepObservation,
  result: PushupRepStrategyResult
): RepObservation {
  let observation: RepObservation = base;
  if (result.signalValue !== undefined) {
    observation = { ...observation, signalValue: result.signalValue };
  }
  if (result.failReason !== undefined) {
    observation = { ...observation, failReason: result.failReason };
  }
  return observation;
}
