import { describe, expect, it } from 'vitest';

import {
  Exercise,
  ExerciseRegistry,
  type SummaryContribution,
  UnknownExerciseError,
  type WorkoutEventLike,
  type XpRule,
} from '../../packages/exercise-core/src/index.js';
import { DefaultExerciseRegistryFactory } from '../../packages/exercise-pushup/src/index.js';

/**
 * Proves the registry is open/closed: a test-only exercise can be
 * added without editing the Exercise base class, the registry, the
 * default factory, or any existing exercise package. All production
 * code paths that look up an exercise by id will now find it.
 */
class JumpingJackXpRule implements XpRule {
  public baseXp(event: WorkoutEventLike): number {
    return Math.floor(event.reps / 5);
  }
}

class JumpingJackSummaryContribution implements SummaryContribution {
  public repsTowardTarget(event: WorkoutEventLike): number {
    return event.reps;
  }

  public marksDayActive(_event: WorkoutEventLike): boolean {
    return false;
  }
}

class JumpingJackExercise extends Exercise {
  public override readonly id: string = 'jumping-jack';
  public override readonly displayName: string = 'Jumping jacks';
  public override readonly xpRule: XpRule = new JumpingJackXpRule();
  public override readonly summaryContribution: SummaryContribution =
    new JumpingJackSummaryContribution();
}

describe('ExerciseRegistry', () => {
  it('starts empty and reports misses with UnknownExerciseError', () => {
    const registry = new ExerciseRegistry();
    expect(registry.has('pushup')).toBe(false);
    expect(() => registry.get('pushup')).toThrow(UnknownExerciseError);
  });

  it('accepts a brand new exercise with only a single register() call', () => {
    const registry = new ExerciseRegistry();
    registry.register(new JumpingJackExercise());
    const exercise = registry.get('jumping-jack');
    expect(exercise.displayName).toBe('Jumping jacks');
    expect(exercise.xpRule.baseXp({ reps: 25 })).toBe(5);
    expect(exercise.summaryContribution.repsTowardTarget({ reps: 25 })).toBe(25);
    expect(exercise.summaryContribution.marksDayActive({ reps: 25 })).toBe(false);
  });

  it('layers test-only exercises on top of the default registry without touching the factory', () => {
    const registry = DefaultExerciseRegistryFactory.create();
    registry.register(new JumpingJackExercise());
    expect(registry.has('set')).toBe(true);
    expect(registry.has('pushup')).toBe(true);
    expect(registry.has('jumping-jack')).toBe(true);
    expect(
      registry
        .list()
        .map((e) => e.id)
        .sort()
    ).toEqual(['jumping-jack', 'pushup', 'set']);
  });
});
