import type { PoseLandmarks } from '@gym/pose';

/**
 * Minimal state machine report returned by {@link PushupRepStrategy}.
 *
 * `repCompleted` is `true` on exactly the frame a rep boundary fires.
 * `inPosition` lets the router distinguish "user has left the push-up
 * pose" from "user is in the pose but mid-rep"; the router aggregates
 * this into the {@link PostureHoldTolerance} window so a brief wobble
 * does not kill the rep.
 *
 * `failReason` carries a short human-readable tag ("go lower", "lock
 * out at the top", "get into position") so the UI can tell the user
 * which check rejected the attempt instead of silently refusing to
 * count.
 */
export interface PushupRepStrategyResult {
  readonly repCompleted: boolean;
  readonly inPosition: boolean;
  readonly phaseLabel: 'unknown' | 'up' | 'down';
  readonly signalValue?: number;
  readonly failReason?: string;
}

/**
 * Per-view rep strategy. One implementation per camera angle: the
 * front-view strategy watches shoulder descent + shoulder width, the
 * side-view strategy watches the most visible arm's elbow angle. The
 * {@link StrictPushupRepDetector} routes frames to whichever strategy
 * matches the current {@link ViewDetector} reading.
 *
 * Strategies are stateful (they remember phase, timing, calibration)
 * and must support {@link reset} so a user can start a fresh session
 * without re-constructing the instance.
 */
export interface PushupRepStrategy {
  processFrame(landmarks: PoseLandmarks, nowMs: number): PushupRepStrategyResult;
  reset(): void;
}
