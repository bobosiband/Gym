# `@gym/exercise-pushup`

Push-up exercise strategy.

Exports:

- `PushupExercise`: the `Exercise` subclass. Id `pushup`, wired to the two strategies below.
- `PushupXpRule`: one XP per ten reps.
- `PushupSummaryContribution`: every rep feeds the daily target. Targets are a MINIMUM: reps above the target still earn XP, still accumulate for lifetime totals, and still trigger achievements. A lone push-up event does not mark the day active on its own (only hitting the target does).
- `PushupRepDetector`: the elbow-angle rep detector, used by the generic `@gym/pose` `RepCounter`.
- `DefaultExerciseRegistryFactory`: seeds an `ExerciseRegistry` with the production default set (`set`, `pushup`).

When a second exercise ships (e.g. squats), its own package registers through the factory. Nothing here is edited.
