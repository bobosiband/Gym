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
export { DefaultExerciseRegistryFactory } from './DefaultExerciseRegistryFactory.js';
