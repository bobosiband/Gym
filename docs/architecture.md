# Gym architecture

Gym is a free, gamified fitness web app, built as a microservice monorepo. This document describes the target architecture for the whole system. During Stage 1 nothing is implemented beyond the folder scaffold; each service listed here is reserved for the stage noted in its row.

## Guiding constraints

- **Zero recurring cost.** Only free tiers (AWS, Cloudflare, Vercel) and on-device compute. Any choice that risks a bill stops for owner review.
- **Privacy.** Camera frames never leave the user's device. Only final counts are sent to the logging service.
- **Grounded coach.** The in-browser AI coach supplies tone, not facts. All exercise instructions, cues and plans come from the catalogue and planner via retrieval.
- **Open/closed.** New quest types, exercises, integrations and events plug in through interfaces; existing working code is not edited to extend behaviour.
- **No cross-service database reads.** Services communicate via versioned events (EventBridge) or via each other's HTTP APIs, defined in `packages/contracts`.

## System overview

See the PlantUML sources under `docs/uml/system/`:

- `overview.puml`: components and dependencies.
- `deployment.puml`: where each component runs.
- `event-flow.puml`: `workout.logged` fan-out to stats, progress and achievements.

CI renders these to SVG on every push and uploads them as a build artefact. See `.github/workflows/uml-check.yml`.

## Service catalogue

Every service listed below is a bounded context. Each owns its own data store and never reads another service's database directly. Proposed languages come from the project spec and are flagged "pending owner approval"; the owner picks the final language at the start of the service's build stage.

### Frontend

#### apps/web (Stage 2)

- **Purpose.** React + TypeScript PWA shell, installable, offline-capable.
- **Proposed language.** TypeScript (pending owner approval).
- **Hosting.** Vercel free tier.
- **Depends on.** All backend services, via API Gateway and Cloudflare Workers, authenticated with a Cognito JWT.
- **Events.** None directly; emits user intents as HTTP calls.

#### apps/pushup-counter (Stage 2)

- **Purpose.** Browser-based push-up counter using MediaPipe Pose. A rep is counted when the elbow angle drops below about 90 degrees and then returns to full extension.
- **Proposed language.** TypeScript (pending owner approval).
- **Runs where.** Entirely in the browser. Camera frames never leave the device.
- **Depends on.** `services/logging` for the final count only.

#### apps/coach (Stage 5)

- **Purpose.** On-device AI coach using WebLLM with a small open model (around 1 to 2 billion parameters, such as Llama 3.2 1B, Qwen, or Gemma). Produces tone and encouragement grounded in retrieved facts.
- **Proposed language.** TypeScript (pending owner approval).
- **Runs where.** Entirely in the browser.
- **Depends on.** `services/catalogue` (facts), `services/planner` (plans). Strictly retrieval-grounded; the model does not invent exercise facts.

### Backend services

#### services/auth (Stage 2)

- **Purpose.** Sign-up, login, email verification, password reset, token issuance. Every other service verifies the auth JWT by configuring an API Gateway JWT authorizer against the auth service's JWKS endpoint.
- **Language.** TypeScript.
- **Infra.** AWS Lambda (not inside a VPC) behind an HTTP API Gateway, DynamoDB on-demand, AWS EventBridge, AWS Systems Manager Parameter Store.
- **Data store.** Two DynamoDB tables: users (keyed by user id, with a `by-email` GSI and an `emailVerified` flag) and sessions (hashed refresh, verify, and reset tokens with Dynamo TTL, plus email abuse counters).
- **Events in.** None.
- **Events out.** `user.registered.v1`.
- **Decision.** The project does not use AWS Cognito, SES, WAF, NAT gateways, VPCs, provisioned concurrency, or KMS customer-managed keys. The service owns its own identity records to stay inside the AWS free tier. Passwords are hashed with argon2id via `@node-rs/argon2`; access tokens are ES256 JWTs signed with `jose` using a private key stored as an SSM SecureString. Email is sent through Gmail SMTP via Nodemailer, behind a swappable `Mailer` interface. See `services/auth/README.md` for the full rationale, endpoint list, and the standard way every other service plugs into the shared JWT authorizer.

#### services/catalogue (Stage 2)

- **Purpose.** Exercise names, muscles, equipment, instructions. Seeded from Free Exercise DB with ExerciseDB and wger as optional additional sources. Licence choices tracked in `docs/SOURCES.md`.
- **Proposed language.** TypeScript (pending owner approval).
- **Infra.** Cloudflare Worker.
- **Data store.** Cloudflare D1 (SQLite).
- **Events in.** None.
- **Events out.** None.

#### services/media (Stage 2)

- **Purpose.** Serves exercise GIFs and images, uploaded ahead of time.
- **Proposed language.** TypeScript (pending owner approval).
- **Infra.** Cloudflare R2.
- **Data store.** R2 bucket.
- **Events in.** None.
- **Events out.** None.

#### services/logging (Stage 2)

- **Purpose.** Records sets, reps, weight, push-up counts.
- **Proposed language.** Java (pending owner approval).
- **Infra.** AWS Lambda + API Gateway.
- **Data store.** AWS DynamoDB (per-user partition key).
- **Events in.** None.
- **Events out.** `workout.logged` on every successful write.

#### services/stats (Stage 4)

- **Purpose.** Charts, history, personal bests.
- **Proposed language.** Python (pending owner approval).
- **Infra.** AWS Lambda.
- **Data store.** DynamoDB (its own tables; never reads logging's tables directly). Materialised from `workout.logged`.
- **Events in.** `workout.logged`.
- **Events out.** None.

#### services/progress (Stage 3)

- **Purpose.** XP, levels, streaks (with streak freezes).
- **Proposed language.** TypeScript (pending owner approval).
- **Infra.** Cloudflare Worker.
- **Data store.** Cloudflare D1.
- **Events in.** `workout.logged`.
- **Events out.** `progress.level_up`.

#### services/achievements (Stage 3)

- **Purpose.** Badges and daily quests.
- **Proposed language.** TypeScript (pending owner approval).
- **Infra.** Cloudflare Worker.
- **Data store.** Cloudflare D1.
- **Events in.** `workout.logged`, `progress.level_up`.
- **Events out.** None (Stage 3 scope). May emit `achievement.awarded` in a later stage.

#### services/planner (Stage 4)

- **Purpose.** Rule-based daily workout plans using goals, recent training and recovery. No model generates plans.
- **Proposed language.** Python (pending owner approval).
- **Infra.** AWS Lambda.
- **Data store.** DynamoDB.
- **Events in.** `workout.logged`.
- **Events out.** None.

#### services/reminders (Stage 4)

- **Purpose.** Web push notifications. Only fires when nothing has been logged today or a streak is at risk.
- **Proposed language.** TypeScript (pending owner approval).
- **Infra.** AWS EventBridge Scheduler + Lambda.
- **Data store.** DynamoDB (push subscription tokens).
- **Events in.** `workout.logged`.
- **Events out.** None.

## Reserved for later

Not built until the owner explicitly asks:

- Strava integration (OAuth import of runs and rides for quests and XP). Strava data must never be fed to the AI coach.
- Boss battles, friend duels, skill trees, recovery score, squat and plank detection, weekly recap.

## Communication rules

- The frontend calls services over HTTPS, authenticated with the auth service's ES256 JWT (verified by an API Gateway JWT authorizer against the JWKS endpoint).
- Services communicate asynchronously via EventBridge where possible. Cloudflare Workers publish to and receive from EventBridge over HTTPS.
- Every event and API schema lives in `packages/contracts` and is versioned. Any schema change is a breaking change and requires owner approval.

## Build order

1. Stage 1 (scaffold only). This file, the UML stubs, the empty service folders, lint and CI pipes.
2. Stage 2. catalogue + media, auth, logging, app shell, push-up counter.
3. Stage 3. progress + achievements, wired to `workout.logged`.
4. Stage 4. planner, stats, reminders.
5. Stage 5. WebLLM coach, grounded in catalogue and planner data.
6. Later. Strava and the reserved features, each as a new service.

If an earlier stage has not finished cleanly, stop and report. Do not build on top of it.
