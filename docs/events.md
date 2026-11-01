# Event catalogue

Every event flowing through EventBridge is listed here and versioned. The authoritative schemas live in `packages/contracts/src/events/`. This document is a human-readable index; it does not declare types.

## Versioning rule

Any change to an event schema is a **breaking change** and needs explicit owner approval before merging. Breaking changes bump the version in the event name (for example, `workout.logged.v1` to `workout.logged.v2`) and the two versions coexist until every consumer has migrated. The old version is only removed after the owner confirms.

## Published events

### user.registered.v1

- **Emitted by.** `services/auth`
- **Emitted when.** A new user record is successfully written to DynamoDB during sign-up. Not re-emitted when `/auth/register` is called again for an already existing account (verified or not), so consumers can treat the event as a true creation signal.
- **Consumed by.** None in Stage 2. Reserved for later services (for example `services/progress` to seed a zero-XP record on first registration).
- **Schema.** `packages/contracts/src/events/userRegistered.v1.ts`.
- **Payload.** `eventId` (UUID v4, idempotency key), `userId` (same subject that appears in access tokens), `registeredAt` (ISO 8601 UTC).

### workout.logged.v1

- **Emitted by.** `services/logging`
- **Emitted when.** A set, rep count, or push-up count is successfully persisted to the workouts table, after the row commit and before the HTTP response is returned. On a retry of a request with the same `Idempotency-Key`, the service re-publishes with the same `eventId` so consumers dedupe cleanly on the bus.
- **Consumed by.** None in Stage 2. Reserved for `services/stats`, `services/progress`, `services/achievements`, `services/planner`, and `services/reminders` from Stage 3 onwards.
- **Schema.** `packages/contracts/src/events/workoutLogged.v1.ts`.
- **Payload.**
  - `eventId` (UUID, idempotency key).
  - `userId` (same subject that appears in access tokens).
  - `workoutId` (UUID, matches the stored record).
  - `loggedAt` (ISO 8601 UTC, set by the service clock).
  - `exerciseId` (opaque identifier into `services/catalogue`; logging does not read catalogue's database).
  - `kind` (`"set"` or `"pushup"`).
  - `reps` (positive integer, 1 to 10 000).
  - `weightKg` (optional, 0 to 10 000).
  - `durationSeconds` (optional, positive integer, 1 to 86 400).

### progress.level_up.v1

- **Emitted by.** `services/progress`
- **Emitted when.** A user's cumulative XP crosses one or more level thresholds inside a single `workout.logged.v1` consumption. `previousLevel` records the level immediately before the crossing so a consumer can compute how many levels were crossed in a batch.
- **Consumed by.** None in Stage 3. Reserved for `services/achievements` (badges keyed off level thresholds).
- **Schema.** `packages/contracts/src/events/progressLevelUp.v1.ts`.
- **Payload.** `eventId` (UUID), `userId`, `previousLevel`, `newLevel`, `xpTotal`, `occurredAt` (ISO 8601 UTC).

### streak.broken.v1

- **Emitted by.** `services/progress`
- **Emitted when.** A counted day arrives more than one calendar day after the user's `lastActiveLocalDate` and the stored freeze balance cannot cover the gap. `previousStreakDays` is at least `1` because a never-started streak never emits this event.
- **Consumed by.** None in Stage 3. Reserved for `services/reminders` (nudge the user) and `services/achievements` (reset streak-based badges).
- **Schema.** `packages/contracts/src/events/streakBroken.v1.ts`.
- **Payload.** `eventId` (UUID), `userId`, `previousStreakDays`, `missedDays`, `occurredAt`.

### streak.frozen.v1

- **Emitted by.** `services/progress`
- **Emitted when.** A counted day arrives more than one calendar day after the user's `lastActiveLocalDate` and the stored freeze balance covers every missed day. The service decrements the freeze balance by `missedDays` before emitting.
- **Consumed by.** None in Stage 3. Reserved for `services/reminders` (surface the freeze-used notification) and `services/achievements`.
- **Schema.** `packages/contracts/src/events/streakFrozen.v1.ts`.
- **Payload.** `eventId` (UUID), `userId`, `streakDaysAfter`, `missedDays`, `remainingFreezes`, `occurredAt`.

## Reserved event names

Reserve the following names so later contributors do not use them for unrelated purposes:

- `achievement.awarded.v1`
- `plan.generated.v1`
- `plan.completed.v1`

Each will be added here with a full definition when its emitting service is built.

## Services that do not emit or consume events

Not every service is an event producer or consumer. Listed for completeness so later contributors do not add rows above for them by mistake:

- `services/catalogue` (built in Stage 2). Read-only HTTP service over Cloudflare D1. Does not publish or consume events.

## Rules for emitting services

- Events are facts, not commands. Name them in past tense: `workout.logged`, not `log.workout`.
- Include `userId` and a UTC timestamp on every event.
- Never put raw camera data, personally identifying information beyond `userId`, or payment data on the bus. This project has no payments; if that changes, revisit this rule with the owner first.
- Idempotency key: consumers must tolerate duplicate deliveries. Include an `eventId` (UUID v7 or similar) on every event.
