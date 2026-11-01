# infra/logging

AWS CDK app for `services/logging`.

- **Status.** Stage 2, implemented. Not deployed.
- **Tool.** AWS CDK v2 (TypeScript).
- **Account.** AWS free tier. Billing alerts must be configured
  before the first deploy.

## Resources

- Two DynamoDB tables in on-demand mode, standard class, retain
  policy:
  - `WorkoutsTable` (PK `pk`, SK `sk`) with a `by-workout` GSI
    (PK `workoutId`, projection ALL) for point lookups by id.
  - `IdempotencyTable` (PK `pk`, TTL attribute `expiresAt`).
- Four Lambda functions (x86_64, Node.js 20, 512 MB, 10 s
  timeout): `logWorkoutLambda`, `getWorkoutLambda`,
  `listWorkoutsLambda`, `healthLambda`. Each has a dedicated
  IAM role scoped to only the tables and SSM parameters it
  needs; health gets no grants at all.
- API Gateway v2 HTTP API with stage-level throttling (20 req/s,
  burst 40) and CORS driven by `APP_ORIGINS` from `.env`.
- Shared `gym-events` EventBridge bus imported by name (created
  by the auth stack). Only `logWorkoutLambda` holds
  `PutEvents` on it.
- SSM standard parameters under `/gym/logging/`:
  - `/gym/logging/app/origins` (seeded by `setup.ts`).
  - `/gym/logging/public/api-url` (published by the stack).
- CloudWatch log groups with 14 day retention per Lambda.

## Deploy

See `services/logging/README.md`.

```
pnpm --filter @gym/logging deploy:bootstrap   # one-time
pnpm --filter @gym/logging setup              # one-time, seeds SSM
pnpm --filter @gym/logging deploy:diff        # review
pnpm --filter @gym/logging deploy             # apply
```
