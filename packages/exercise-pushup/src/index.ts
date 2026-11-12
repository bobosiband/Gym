/**
 * Public entry point for `@gym/exercise-pushup`.
 *
 * Exports the push-up exercise strategy, its XP rule and summary
 * contribution (each in its own file so a reviewer can reason about
 * one piece at a time), and the rep detector that UI callers compose
 * with the generic {@link RepCounter}.
 */

export { PushupExercise } from './PushupExercise.js';
export { PushupXpRule } from './PushupXpRule.js';
export { PushupSummaryContribution } from './PushupSummaryContribution.js';
export { PushupRepDetector } from './PushupRepDetector.js';
export type { PushupRepDetectorOptions } from './PushupRepDetector.js';
export { StrictPushupRepDetector } from './StrictPushupRepDetector.js';
export type {
  StrictPushupRepDetectorOptions,
  StrictPushupPhase,
} from './StrictPushupRepDetector.js';
export { AngleSmoother } from './strategies/AngleSmoother.js';
export { ElbowAngleStrategy } from './strategies/ElbowAngleStrategy.js';
export type { ElbowAngleStrategyOptions, ElbowReading } from './strategies/ElbowAngleStrategy.js';
export { PostureGate } from './strategies/PostureGate.js';
export type { PostureGateOptions, PostureEvaluation } from './strategies/PostureGate.js';
export { RepTimingGate } from './strategies/RepTimingGate.js';
export type { RepTimingGateOptions } from './strategies/RepTimingGate.js';
export { ShoulderDropStrategy } from './strategies/ShoulderDropStrategy.js';
export type { ShoulderDropStrategyOptions } from './strategies/ShoulderDropStrategy.js';
export { DefaultExerciseRegistryFactory } from './DefaultExerciseRegistryFactory.js';
