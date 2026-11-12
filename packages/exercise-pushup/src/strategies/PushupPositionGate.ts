import type { PoseLandmarks } from '@gym/pose';

import type { PushupViewKind } from './PushupViewKind.js';

/**
 * Result of a single position check. `inPosition` is the boolean the
 * state machine acts on; `reason` is the short human-readable tag the
 * UI surfaces when the gate rejects the frame. `view` is stamped in
 * by the composite gate so the caller knows which view the decision
 * came from. The two legacy numeric fields are kept optional for
 * backward compatibility with {@link PostureGate} readouts.
 */
export interface PushupPositionEvaluation {
  readonly inPosition: boolean;
  readonly reason?: string;
  readonly view?: PushupViewKind;
  readonly torsoTiltDegrees?: number | null;
  readonly bodyStraightnessDegrees?: number | null;
}

/**
 * Pluggable strategy for deciding, per frame, whether the user is in
 * a push-up position. One implementation per camera view; a composite
 * dispatches by the live view reading.
 */
export interface PushupPositionGate {
  evaluate(landmarks: PoseLandmarks): PushupPositionEvaluation;
}
