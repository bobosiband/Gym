/**
 * Public entry point for `@gym/exercise-core`.
 *
 * Every exercise in the system is a subclass of {@link Exercise}
 * supplying its own {@link XpRule} and {@link SummaryContribution}.
 * Services and apps look exercises up by id through
 * {@link ExerciseRegistry}; nothing in this package is edited when a
 * new exercise ships.
 */

export { Exercise } from './Exercise.js';
export { ExerciseRegistry, UnknownExerciseError } from './ExerciseRegistry.js';
export type { XpRule } from './XpRule.js';
export type { SummaryContribution } from './SummaryContribution.js';
export type { WorkoutEventLike } from './WorkoutEventLike.js';
export { SetExercise, SetXpRule, SetSummaryContribution } from './SetExercise.js';
