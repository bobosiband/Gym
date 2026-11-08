import type { SummaryContribution } from './SummaryContribution.js';
import type { XpRule } from './XpRule.js';

/**
 * A registered exercise plus the strategies that score it.
 *
 * `id` must be stable: it is the string stored on every logged
 * workout and the key under which the exercise is published on the
 * event bus. Lower-case kebab is the convention (`pushup`, `set`,
 * `barbell-squat`).
 *
 * `displayName` is for UIs and never used for routing or lookup.
 *
 * Subclasses live under `packages/exercise-<slug>/`. Adding a new
 * exercise is a new subclass file plus a registration in the default
 * {@link ExerciseRegistryFactory}; nothing in this base package is
 * edited to extend behaviour.
 */
export abstract class Exercise {
  public abstract readonly id: string;
  public abstract readonly displayName: string;
  public abstract readonly xpRule: XpRule;
  public abstract readonly summaryContribution: SummaryContribution;
}
