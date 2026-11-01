# infra/progress

AWS CDK app for `services/progress`.

- **Status.** Stage 3, defined. Not deployed.
- **Tool choice.** AWS CDK (TypeScript).
- **Account.** AWS free tier.

## Why AWS and not Cloudflare

The original Stage 3 pencil note in `docs/architecture.md` planned
`services/progress` on Cloudflare Workers + D1. The overnight
rebuild moved it to AWS Lambda + DynamoDB because the service must
consume `workout.logged.v1` from the AWS EventBridge bus the logging
service already emits to. Bridging EventBridge to a Cloudflare Worker
means either paying for API Gateway forwarding or spinning up a
Lambda relay, neither of which fits the zero-cost rule. Keeping the
consumer on AWS keeps everything on the same free-tier plane.

The architecture doc has been updated in the same PR to reflect this
decision.

## Topology

- `HttpApi` (API Gateway v2, no fixed cost) with four routes:
  - `GET /health`
  - `GET /progress` (bearer, caller's state)
  - `PUT /progress/timezone` (bearer, set the user's IANA zone)
  - `POST /progress/daily-target` (bearer, start a target)
- `StateTable` (DynamoDB, PAY_PER_REQUEST). PK + SK, one row per
  user per concept (`STATE`, `DAY#<localDate>`).
- `ProcessedEventTable` (DynamoDB, PAY_PER_REQUEST, TTL on
  `expiresAt`). Idempotency gate for the EventBridge consumer.
- `WorkoutLoggedRule`: EventBridge rule filtering `workout.logged.v1`
  on the shared `gym-events` bus, invoking the consumer Lambda.
- Five Lambdas (Node.js 20, x86_64, 512 MiB): health, getProgress,
  setTimeZone, setDailyTarget, workoutLoggedConsumer.
- Stage-level throttling: 20 req/s with a burst of 40 per route.

## Prerequisites

Owner must run these once, out of band:

1. `pnpm --filter @gym/infra-progress deploy:bootstrap` (if CDK has
   never been bootstrapped in this account).
2. Seed SSM parameters:
   - `/gym/progress/app/origins`: comma-separated origins, or `*`.
3. The shared `gym-events` bus already exists in the account (the
   auth stack created it).

The deploy ensures each Lambda has `ssm:GetParameter` on
`/gym/auth/public/*` so JWT verification bootstraps from the auth
service's JWKS without hardcoding.

## Deploy (owner only, not run tonight)

```
pnpm --filter @gym/infra-progress synth
pnpm --filter @gym/infra-progress diff
pnpm --filter @gym/infra-progress deploy
```

## Observability

CloudWatch log retention is 14 days (set per-Lambda log group). The
EventBridge rule logs delivery metrics automatically.

## Decisions made overnight

1. **AWS Lambda, not Cloudflare Worker.** EventBridge consumer must
   stay on AWS to avoid bridging cost. Documented in
   `docs/architecture.md` under the service row.
2. **Separate `ProcessedEventTable` from the state table.** The
   state table is read on every write; a dedicated small table for
   idempotency claims keeps the hot read path narrow and gives the
   TTL sweeper its own partition. Mirrors `services/logging`.
3. **Shared `gym-events` bus.** No second bus. Progress's
   `progress.level_up.v1`, `streak.broken.v1`, and `streak.frozen.v1`
   all land on the same bus.
4. **Internal `grantFreezes` only.** No HTTP route exposes freeze
   grants today; the quest service in a later stage will call the
   method directly. Freeze cap at 2.
5. **PAY_PER_REQUEST + RETAIN removal policy.** On-demand pricing
   fits the free tier at low volume; retention protects user data
   on a stack-level teardown.
