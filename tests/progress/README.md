# tests/progress

Vitest suite for `services/progress`. Runs under Node with every AWS boundary replaced by in-memory fakes: DynamoDB, EventBridge, the clock, and the id generator. No AWS credentials or network access are required.

## Covered

- `LocalDate.test.ts`: time-zone resolution, day deltas, DST robustness.
- `XpRules.test.ts`: XP per event kind, quadratic level curve, xp-to-next-level.
- `StreakRules.test.ts`: started / held / advanced / frozen / broken transitions and the read-time `effectiveStreak`.
- `FreezeRules.test.ts`: cap enforcement, negative requests.
- `ProgressService.test.ts`: full service orchestration. Covers:
  - A new user is seeded at level 1 with XP 0.
  - Replay protection via `eventId`.
  - XP, level, daily target progress and streaks update together.
  - Daily-target bonus XP fires once per hit day.
  - `streak.broken.v1`, `streak.frozen.v1`, `progress.level_up.v1` emitted at the right moments.
  - A resistance `set` counts as an active day with or without a target.
  - Time zone-driven local date resolution (an event logged just before Sydney midnight lands on the next local day).
  - `grantFreezes` honours the global cap.

Run from the repo root:

```
pnpm --filter @gym/progress test
```
