/**
 * Public entry point for `@gym/exercise-pushup`.
 *
 * Exports the push-up exercise strategy, its XP rule and summary
 * contribution (each in its own file so a reviewer can reason about
 * one piece at a time), and the rep detector that UI callers compose
 * with the generic {@link RepCounter}. The per-view strategies and
 * their shared interfaces are also exported so callers can tune or
 * replace a single strategy without reaching inside the barrel.
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
export { FrontShoulderSignalStrategy } from './strategies/FrontShoulderSignalStrategy.js';
export type { FrontShoulderSignalStrategyOptions } from './strategies/FrontShoulderSignalStrategy.js';
export { SideArmElbowStrategy } from './strategies/SideArmElbowStrategy.js';
export type { SideArmElbowStrategyOptions } from './strategies/SideArmElbowStrategy.js';
export { PostureHoldTolerance } from './strategies/PostureHoldTolerance.js';
export type { PostureHoldToleranceOptions } from './strategies/PostureHoldTolerance.js';
export type {
  PushupRepStrategy,
  PushupRepStrategyResult,
} from './strategies/PushupRepStrategy.js';
export { AngleSmoother } from './strategies/AngleSmoother.js';
export { ElbowAngleStrategy } from './strategies/ElbowAngleStrategy.js';
export type { ElbowAngleStrategyOptions, ElbowReading } from './strategies/ElbowAngleStrategy.js';
export { PostureGate } from './strategies/PostureGate.js';
export type { PostureGateOptions, PostureEvaluation } from './strategies/PostureGate.js';
export { FrontPostureGate } from './strategies/FrontPostureGate.js';
export type { FrontPostureGateOptions } from './strategies/FrontPostureGate.js';
export { ViewDetector } from './strategies/ViewDetector.js';
export type { ViewDetectorOptions } from './strategies/ViewDetector.js';
export { CompositePushupPositionGate } from './strategies/CompositePushupPositionGate.js';
export type { CompositePushupPositionGateArgs } from './strategies/CompositePushupPositionGate.js';
export { CompositeDescentStrategy } from './strategies/CompositeDescentStrategy.js';
export type { CompositeDescentStrategyArgs } from './strategies/CompositeDescentStrategy.js';
export { DropoutTolerance } from './strategies/DropoutTolerance.js';
export type { DropoutToleranceOptions } from './strategies/DropoutTolerance.js';
export { RepTimingGate } from './strategies/RepTimingGate.js';
export type { RepTimingGateOptions } from './strategies/RepTimingGate.js';
export { ShoulderDropStrategy } from './strategies/ShoulderDropStrategy.js';
export type { ShoulderDropStrategyOptions } from './strategies/ShoulderDropStrategy.js';
export { FrontDescentStrategy } from './strategies/FrontDescentStrategy.js';
export type { FrontDescentStrategyOptions } from './strategies/FrontDescentStrategy.js';
export type {
  PushupPositionGate,
  PushupPositionEvaluation,
} from './strategies/PushupPositionGate.js';
export type { DescentStrategy } from './strategies/DescentStrategy.js';
export type { PushupViewKind } from './strategies/PushupViewKind.js';
export { DefaultExerciseRegistryFactory } from './DefaultExerciseRegistryFactory.js';
