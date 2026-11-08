import { Exercise } from './Exercise.js';
import type { SummaryContribution } from './SummaryContribution.js';
import type { WorkoutEventLike } from './WorkoutEventLike.js';
import type { XpRule } from './XpRule.js';

/**
 * Default XP rule for a generic resistance set: a flat amount per
 * event regardless of reps or weight. Progressive overload is the
 * planner's job; XP just rewards logging the set.
 */
export class SetXpRule implements XpRule {
  public static readonly SET_XP = 10;

  public baseXp(_event: WorkoutEventLike): number {
    return SetXpRule.SET_XP;
  }
}

/**
 * Default summary contribution for a resistance set: does not feed a
 * reps-based daily target, but a single logged set is enough to mark
 * the day active for the streak.
 */
export class SetSummaryContribution implements SummaryContribution {
  public repsTowardTarget(_event: WorkoutEventLike): number {
    return 0;
  }

  public marksDayActive(_event: WorkoutEventLike): boolean {
    return true;
  }
}

/**
 * Generic "manual set" exercise. Covers every resistance-training
 * entry the user logs by hand (bench press, squat, deadlift). The
 * `exerciseId` on the event identifies the catalogue row; the `kind`
 * stays `set` so the progress service can score every resistance
 * exercise through the same strategy.
 *
 * Push-up form entries never come through this strategy; they are
 * scored by {@link PushupExercise} in `@gym/exercise-pushup`.
 */
export class SetExercise extends Exercise {
  public override readonly id: string = 'set';
  public override readonly displayName: string = 'Resistance set';
  public override readonly xpRule: XpRule = new SetXpRule();
  public override readonly summaryContribution: SummaryContribution = new SetSummaryContribution();
}
