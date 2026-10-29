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

## Draft events (Stage 1, not yet implemented)

### workout.logged.v1

- **Emitted by.** `services/logging`
- **Emitted when.** A set, rep count, or push-up count is successfully persisted.
- **Consumed by.** `services/stats`, `services/progress`, `services/achievements`, `services/planner`, `services/reminders`.
- **Payload (planned).** `userId`, `loggedAt` (ISO 8601 UTC), `exerciseId` (foreign key into catalogue), `kind` ("set" or "pushup"), `reps`, `weightKg` (optional), `durationSeconds` (optional). Exact schema is finalised when `services/logging` is built in Stage 2.

### progress.level_up.v1

- **Emitted by.** `services/progress`
- **Emitted when.** A user crosses an XP threshold.
- **Consumed by.** `services/achievements`.
- **Payload (planned).** `userId`, `newLevel`, `levelAt` (ISO 8601 UTC), `xpTotal`. Exact schema is finalised when `services/progress` is built in Stage 3.

## Reserved event names

Reserve the following names so later contributors do not use them for unrelated purposes:

- `achievement.awarded.v1`
- `streak.broken.v1`
- `streak.frozen.v1`
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
