# `@gym/exercise-core`

Pluggable exercise abstraction shared by every service and app in the Gym monorepo.

The package is deliberately tiny:

- `Exercise` (abstract class): id, display name, XP rule, summary contribution.
- `XpRule` (interface): per-event base XP for one exercise.
- `SummaryContribution` (interface): how an event folds into a day's summary (reps toward target, whether the event marks the day active on its own).
- `ExerciseRegistry`: map from id to `Exercise` with a strict `get` that throws `UnknownExerciseError` on misses.
- `SetExercise`: the default strategy for manual resistance-set entries.

The push-up strategy and the factory that seeds the default registry live in `@gym/exercise-pushup`. Adding a new exercise is a new subclass of `Exercise` in its own package, registered through the factory (or directly by tests). Nothing in this package is edited to extend behaviour.

## Usage

```ts
import { ExerciseRegistry } from '@gym/exercise-core';
import { DefaultExerciseRegistryFactory } from '@gym/exercise-pushup';

const exercises = DefaultExerciseRegistryFactory.create();
const pushup = exercises.get('pushup');
const xp = pushup.xpRule.baseXp({ reps: 100 }); // 10
const reps = pushup.summaryContribution.repsTowardTarget({ reps: 100 }); // 100
```

Tests can shadow a default exercise or register a brand new one without touching the shared factory, demonstrated in `tests/exercise-core/ExerciseRegistry.test.ts`.
