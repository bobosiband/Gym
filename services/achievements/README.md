# `@gym/achievements`

Stage 3 achievements service.

- Platform: Cloudflare Worker + D1.
- Consumes `workout.logged.v1` and `progress.level_up.v1` via an authenticated internal webhook.
- Emits `achievement.unlocked.v1` the first time a user satisfies a badge rule (idempotent on the natural key `(userId, badgeId)`).
- JWT-authenticated `GET /achievements` returns the caller's badges newest-first.

## Why Cloudflare

Consistent with `services/catalogue` and `services/media`: free tier, no cold-start billing, D1 is enough for the badge roll-up rows this service holds. The published event side is a `LoggingEventPublisher` today because no subscriber exists yet; architecture tracks `achievement.unlocked.v1` as a Stage 3 emission to prepare for one.

## Endpoints

| Method | Path          | Auth                  | Purpose                                                 |
| ------ | ------------- | --------------------- | ------------------------------------------------------- |
| GET    | /health       | none                  | Liveness probe.                                         |
| GET    | /achievements | JWT (JWKS)            | Return the caller's unlocked badges, newest first.      |
| POST   | /events       | X-Internal-Events-Key | EventBridge-shaped envelope. Dispatches to the service. |

Full schema: `docs/swagger/achievements.yaml`. Core class map: `docs/uml/achievements/class.puml`. Event ingestion flow: `docs/uml/achievements/sequence-event-ingest.puml`.

## Badge rules

Starter set (open/closed; new badges are new files in `src/badges/`):

| Badge              | Rule                                                   |
| ------------------ | ------------------------------------------------------ |
| `first-workout`    | First logged workout of any kind.                      |
| `total-reps-100`   | 100 total reps across any combination of exercises.    |
| `seven-day-streak` | Seven consecutive local dates with at least one event. |
| `level-5`          | Hit level 5 (per the progress service's level curve).  |

Each rule carries its own frozen `name` and `description`; renaming the class never retroactively rewrites a user's history.

## Idempotency

The webhook claims incoming `eventId`s in the `processed_events` table before dispatching. A retry with the same id is a no-op; the badge rows are protected a second time by the `(userId, badgeId)` primary key.

## Local development

```
wrangler d1 create gym-achievements        # one-off
# paste the returned database_id into wrangler.toml
pnpm --filter @gym/achievements db:migrate:local
pnpm --filter @gym/achievements dev
```

Run the test suite:

```
pnpm --filter @gym/achievements test
```

Tests run inside a Miniflare-backed Workers isolate with a real local D1 database, per the "no mocks for the database boundary" rule in `tests/README.md`.

## Deploy checklist

1. `wrangler d1 create gym-achievements` (returns a database id).
2. Paste the id into `wrangler.toml`.
3. `pnpm --filter @gym/achievements db:migrate:remote`.
4. `wrangler secret put INTERNAL_EVENTS_KEY` (generate a strong random string; share with whichever system forwards EventBridge events).
5. `pnpm --filter @gym/achievements deploy`.
6. Smoke test: `curl $WORKER_URL/health`.
