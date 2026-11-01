# services/progress

XP, levels, Duolingo-style streaks with automatic streak freezes, and a daily push-up target. Consumes `workout.logged.v1` and emits `progress.level_up.v1`, `streak.broken.v1`, `streak.frozen.v1`.

- **Status.** Stage 3, implemented. Not deployed.
- **Language.** TypeScript.
- **Infra.** AWS Lambda behind an HTTP API Gateway, DynamoDB on demand, shared `gym-events` EventBridge bus, SSM Parameter Store (standard tier). No Cognito, SES, WAF, NAT, VPC, provisioned concurrency, or KMS customer-managed keys.
- **Data store.** Single DynamoDB table (`StateTable`, pk + sk) holding both per-user state (`sk = STATE`) and per-day roll-ups (`sk = DAY#<localDate>`), plus a dedicated `ProcessedEventTable` for event-id-based idempotency with Dynamo TTL.
- **Events in.** `workout.logged.v1` (from `services/logging`).
- **Events out.** `progress.level_up.v1`, `streak.broken.v1`, `streak.frozen.v1`.

## Why AWS, not Cloudflare

The architecture doc originally slotted this service on Cloudflare Workers + D1. Keeping it on AWS Lambda avoids bridging the EventBridge bus to Cloudflare, which would mean either a paid API Gateway hop or a Lambda relay. The owner's zero-cost rule overrides the earlier placement, so the service lives in `infra/progress` as a CDK app alongside `infra/logging`. See the matching row in `docs/architecture.md`.

## Endpoints

Every response is JSON. Error bodies follow `ProgressApi.ProgressApiError`.

| Method | Path                     | Purpose                                    | Auth   |
| ------ | ------------------------ | ------------------------------------------ | ------ |
| GET    | `/health`                | Liveness probe (no backing-service reads)  | None   |
| GET    | `/progress`              | Return the caller's full progress snapshot | Bearer |
| PUT    | `/progress/timezone`     | Update the caller's IANA time zone         | Bearer |
| POST   | `/progress/daily-target` | Start or replace the caller's daily target | Bearer |

The response schema is defined in `packages/contracts/src/api/progress.ts`.

## Events

### workout.logged.v1 (consumed)

Each event increments the day's push-up or set roll-up for the user, resolves the day boundary in the user's IANA zone, and updates:

- `xp`: `floor(reps / 10)` for a push-up event; `10 XP` for a set; a one-time `50 XP` bonus the first time the daily target is hit on a given day.
- `level`: `floor(sqrt(xp / 100))`, clamped at `1` for XP < 100.
- `streakDays`: advanced on consecutive counted days, consumes a freeze when a single day is missed, resets to `1` otherwise.
- `dailyTarget.remainingReps` and `dailyTarget.completedDays`.

Replays are dropped via `ProcessedEventTable.tryClaim(eventId, 30 days)`.

### progress.level_up.v1 (emitted)

Published whenever the user crosses one or more level thresholds in a single event. `previousLevel` lets consumers compute how many levels were crossed in a batch (useful when a late-arriving event credits several days at once).

### streak.broken.v1 (emitted)

Published when a counted day arrives more than one day after the last active day and the freeze balance cannot cover the gap. `previousStreakDays` is at least `1` because a never-started streak never emits this event.

### streak.frozen.v1 (emitted)

Published when a counted day arrives more than one day after the last active day and the freeze balance covers every missed day. `remainingFreezes` reports the balance after the deduction.

## Streak and freeze rules

- A day "counts" when either the daily push-up target was hit (if a target is set) or at least one `kind: 'set'` workout was logged.
- Day boundary is the user's local midnight; zone is stored on the state row and updated via `PUT /progress/timezone`. The default zone is `UTC` for a brand new user.
- Freeze cap is `2`. Freezes are consumed automatically when a day is missed. Freezes will be earned via quests in a later service; today the only grant path is `ProgressService.grantFreezes(userId, amount)` (internal, no HTTP route).
- A completed gym session (one or more `kind: 'set'` logs) counts as a day's activity in addition to hitting the push-up target. This is recorded as a decision in the overnight report.

## Security posture

- **Authentication.** Each data-plane Lambda verifies the Bearer JWT inline against the auth service's JWKS endpoint (`JwksJwtVerifier`, ES256 only).
- **Rate limiting.** API Gateway stage-level throttling of 20 req/s with a burst of 40 on every route.
- **Validation.** Every body is validated against a strict Zod schema (unknown fields rejected) with a 4 KiB raw payload cap enforced before JSON parsing.
- **Ownership.** `GET /progress` is scoped to the JWT subject; the service never trusts a client-supplied user id.
- **CORS.** Origins listed in `APP_ORIGINS` (via SSM at `/gym/progress/app/origins`) are allowed. `*` is permitted during early frontend bring-up per the owner's 2026-10-29 policy update.
- **IAM.** Each Lambda has a dedicated role scoped to the specific table, parameter prefix, and (for the consumer only) the shared event bus. The health Lambda has no grants at all.
- **Logging.** Structured JSON with request id. Tokens, email, and raw payloads are never logged. CloudWatch log retention is 14 days.

## Local environment (`services/progress/.env`)

The repo ignores `services/progress/.env` so credentials never land in a commit. Copy `.env.example` and fill it in:

```
AWS_ACCESS_KEY_ID=        # the deploy user's key
AWS_SECRET_ACCESS_KEY=    # the deploy user's secret
AWS_REGION=ap-southeast-2
APP_ORIGINS=*             # comma-separated list, or * for all
```

## Setup and deploy

```
pnpm --filter @gym/infra-progress synth   # verify the stack
pnpm --filter @gym/infra-progress diff    # review the CloudFormation diff
pnpm --filter @gym/infra-progress deploy  # apply (owner only)
```

The overnight run does not deploy.

## Tests

```
pnpm --filter @gym/progress test
```

Runs the full Vitest suite under Node. No AWS credentials are required: DynamoDB, EventBridge, clock, id generator and JWT verifier are replaced with in-memory fakes in `tests/progress/support/`. See `tests/progress/README.md` for the full case list.

## Decisions made overnight

1. **AWS Lambda + DynamoDB (not Cloudflare).** Keeps the EventBridge consumer local to the AWS plane, matching the owner's zero-cost rule. The architecture doc now reflects this.
2. **XP curve: `floor(sqrt(xp / 100))`.** Clean closed form, feels progressive, no table lookup. Level 1 at 100 XP, level 2 at 400, level 3 at 900.
3. **Push-up XP: 1 per 10 reps.** A 100-rep day earns 10 XP + 50 XP target bonus = 60 XP, so a target streak of ~7 days reaches level 2 (400 XP).
4. **Set XP: flat 10 per logged set.** The service does not know a user's one-rep max; a flat per-set reward keeps resistance training competitive with push-ups without inflating.
5. **Daily-target bonus fires once per hit day.** The service tracks `targetHit` on the daily summary row; the bonus is awarded on the exact event that pushes the user over the threshold.
6. **"Counted day" accepts either push-up target or a resistance set.** The architecture doc's streak rule mentions a completed gym session; this is the concrete definition.
7. **Freeze cap at 2.** Matches the overnight brief. `grantFreezes` is internal only; no HTTP endpoint exposes it until the quest service lands.
8. **Day boundary via `Intl.DateTimeFormat` (no `tz` package).** Node 20 ships ICU, so IANA zones resolve natively with zero new dependencies.
9. **Replay protection via a dedicated `ProcessedEventTable`.** 30-day TTL. Separating idempotency rows from state rows keeps the hot write path narrow.
10. **Effective streak computed at read time.** Writes always update `streakDays` based on the arriving event. `GET /progress` collapses the stored streak against today's local date and reports an `effectiveStreakDays` of `0` when the user has blown past their freeze budget. No nightly scheduler needed.

## Related

- Architecture: `docs/architecture.md`.
- Events: `docs/events.md` (sections `progress.level_up.v1`, `streak.broken.v1`, `streak.frozen.v1`).
- Diagrams: `docs/uml/progress/`.
- Contracts: `packages/contracts/src/api/progress.ts`, `packages/contracts/src/events/*V1*.ts`.
