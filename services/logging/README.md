# services/logging

Workout log for the Gym project. Accepts sets, reps and push-up
counts, publishes `workout.logged.v1` on every successful write,
and serves the caller's own history.

- **Status.** Stage 2, implemented. Not deployed.
- **Language.** TypeScript.
- **Infra.** AWS Lambda behind an HTTP API Gateway, DynamoDB on
  demand, shared EventBridge bus (`gym-events`), SSM Parameter
  Store (standard tier). No Cognito, SES, WAF, NAT gateway, VPC,
  provisioned concurrency, or KMS customer-managed keys.
- **Events in.** None.
- **Events out.** `workout.logged.v1`.

## Why its own service

The push-up counter in `apps/pushup-counter` runs entirely on the
device and the camera frames never leave the browser. The final
count still has to be durably stored so progress, achievements
and stats can build on it. Logging is the smallest service that
owns that write path end to end: it validates the caller, writes
the row, and publishes the fact. Every other backend service
reacts to `workout.logged.v1` and never reads this service's
tables (per `docs/architecture.md`).

## Endpoints

Every response is JSON. Error bodies follow
`LoggingApi.LoggingApiError` in `@gym/contracts/api/logging` and
carry a stable `code` for machine routing.

| Method | Path                    | Purpose                                             | Auth   |
| ------ | ----------------------- | --------------------------------------------------- | ------ |
| GET    | `/health`               | Liveness probe (no backing-service reads)           | None   |
| POST   | `/workouts`             | Record a workout and publish `workout.logged.v1`    | Bearer |
| GET    | `/workouts`             | List the caller's workouts, newest first, paginated | Bearer |
| GET    | `/workouts/{workoutId}` | Fetch a single workout owned by the caller          | Bearer |

OpenAPI 3.1 spec: [`docs/swagger/logging.yaml`](../../docs/swagger/logging.yaml).
Regenerate with `pnpm --filter @gym/logging gen:openapi` whenever
`packages/contracts/src/api/logging.ts` changes; a committed-vs-
generated drift test in `tests/logging/OpenApiSpec.test.ts`
fails the PR if they diverge.

## Idempotency

`POST /workouts` accepts an optional `Idempotency-Key` header
(8-64 chars, `[A-Za-z0-9_-]`). The service writes a per-user
idempotency row with the pre-generated `workoutId` and `eventId`
before persisting the workout or publishing. On a retry with the
same key:

- `status=completed`: the cached response is returned verbatim.
- `status=in_progress`: the service re-publishes with the stored
  `eventId` (consumers dedupe per `docs/events.md`), marks the
  row completed, and returns the cached response. If the publish
  keeps failing it returns `503 SERVICE_UNAVAILABLE`.

The idempotency row has a 24 hour TTL and is swept by DynamoDB.

## Security posture

- **Authentication.** Each data-plane Lambda verifies the Bearer
  JWT inline against the auth service's JWKS endpoint
  (`JwksJwtVerifier`, ES256 only). The issuer, audience, and
  JWKS URL are read from SSM at cold start under
  `/gym/auth/public/*`.
- **Rate limiting.** API Gateway stage-level throttling of 20
  req/s with a burst of 40 on every route.
- **Validation.** Every body is validated against a strict Zod
  schema (unknown fields rejected) with a 4 KiB raw payload cap
  enforced before JSON parsing.
- **Ownership.** `GET /workouts/{workoutId}` returns 404 both
  for missing and foreign workouts so an attacker cannot
  enumerate ids. `GET /workouts` is scoped to the caller.
- **CORS.** Origins listed in `APP_ORIGINS` are allowed. Set
  `APP_ORIGINS=*` to allow all origins (permitted during early
  frontend bring-up per the owner's 2026-10-29 policy update);
  otherwise, comma-separate explicit origins.
- **Secrets.** Nothing hardcoded. CORS allow list lives in SSM
  under `/gym/logging/app/origins`. The service holds no secret
  material of its own; JWT verification uses only the public JWKS.
- **IAM.** Each Lambda has a dedicated role scoped to the
  specific table, parameter prefix, and (for log-workout only)
  the shared event bus. The health Lambda has no grants at all.
  No wildcard resources.
- **Logging.** Structured JSON lines with a request id. Tokens
  and payloads are never logged. CloudWatch log retention is 14
  days.

## Local environment (services/logging/.env)

The repo ignores `services/logging/.env` so credentials never
land in a commit. Copy `.env.example` and fill it in:

```
AWS_ACCESS_KEY_ID=        # the deploy user's key
AWS_SECRET_ACCESS_KEY=    # the deploy user's secret
AWS_REGION=ap-southeast-2
APP_ORIGINS=*             # comma-separated list, or * for all
```

## Setup and deploy

```
pnpm --filter @gym/logging deploy:bootstrap   # one-time, idempotent
pnpm --filter @gym/logging setup              # one-time, seeds /gym/logging/app/origins
pnpm --filter @gym/logging deploy:diff        # review the CloudFormation diff
pnpm --filter @gym/logging deploy             # apply
```

After the first deploy, read the `ApiUrl` CfnOutput from the
stack, update `services/logging/openapi.servers.json`, and
regenerate the spec:

```
pnpm --filter @gym/logging gen:openapi
```

Commit the updated `docs/swagger/logging.yaml` as
`docs(logging): set production server URL after first deploy`.

## Tests

```
pnpm --filter @gym/logging test
```

Runs the full Vitest suite under Node. No AWS credentials are
required: DynamoDB, EventBridge, clock, id generator, and JWT
verifier are replaced with in-memory fakes in
`tests/logging/support`. The JWKS verifier itself is unit-tested
against a loopback HTTP server (no external network). See
`tests/logging/README.md` for the full case list.

## Related

- Architecture: `docs/architecture.md`.
- Events: `docs/events.md` (section `workout.logged.v1`).
- Diagrams: `docs/uml/logging/`.
- Contracts: `packages/contracts/src/api/logging.ts`,
  `packages/contracts/src/events/workoutLogged.v1.ts`.
- OpenAPI spec: `docs/swagger/logging.yaml`.
