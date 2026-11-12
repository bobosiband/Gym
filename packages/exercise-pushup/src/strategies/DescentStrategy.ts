import type { PoseLandmarks } from '@gym/pose';

/**
 * Pluggable strategy for verifying that the body actually moves down
 * and back up during a rep. Side-view implementations watch the
 * shoulder dropping toward the hips; front-view implementations watch
 * the head (shoulder midpoint plus nose) dropping toward the wrists.
 *
 * The detector calls `markUp` when it enters the up phase, `observe`
 * on every frame of the rep attempt, and `isDescentSufficient` at
 * the candidate rep boundary (down to up transition). `reset` is
 * called on posture lapses and when the state machine is reset.
 */
export interface DescentStrategy {
  reset(): void;
  markUp(landmarks: PoseLandmarks): void;
  observe(landmarks: PoseLandmarks): void;
  isDescentSufficient(): boolean;
}
