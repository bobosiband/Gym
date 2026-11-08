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
- **Language.** TypeScript.
- **Infra.** AWS Lambda behind an HTTP API Gateway, DynamoDB on-demand, EventBridge (shared `gym-events` bus), SSM standard parameters. No VPC, NAT, provisioned concurrency, WAF, Cognito, or KMS customer-managed keys.
- **Data store.** Two DynamoDB tables: a workouts table (partition key `pk = USER#<userId>`, sort key `sk = WORKOUT#<loggedAt>#<workoutId>`, GSI `by-workout` for point lookups) and an idempotency table (TTL-swept, keyed by `(userId, idempotencyKey)`).
- **Events in.** None.
- **Events out.** `workout.logged.v1` on every successful write.
- **API spec.** `docs/swagger/logging.yaml` (OpenAPI 3.1, generated from the Zod schemas in `packages/contracts/src/api/logging.ts`).
- **Decision.** The service verifies the auth JWT inline inside each Lambda via `JwksJwtVerifier` (jose's `createRemoteJWKSet`, 10 minute cache) rather than through an API Gateway JWT authorizer, mirroring the auth service's `/auth/me` rationale. See `services/logging/README.md` for the endpoints table, security posture, and the idempotency state machine.

#### services/stats (Stage 4)

- **Purpose.** Charts, history, personal bests.
- **Proposed language.** Python (pending owner approval).
- **Infra.** AWS Lambda.
- **Data store.** DynamoDB (its own tables; never reads logging's tables directly). Materialised from `workout.logged`.
- **Events in.** `workout.logged`.
- **Events out.** None.

#### services/progress (Stage 3)

- **Purpose.** XP, levels, Duolingo-style streaks (with streak freezes), and a daily push-up target.
- **Language.** TypeScript.
- **Infra.** AWS Lambda behind an HTTP API Gateway, DynamoDB on demand, shared `gym-events` EventBridge bus, SSM Parameter Store (standard tier). No Cognito, SES, WAF, NAT, VPC, provisioned concurrency, or KMS customer-managed keys.
- **Data store.** Two DynamoDB tables: a state table (`pk = USER#<userId>`, `sk = STATE` or `DAY#<localDate>`) and an idempotency table (TTL-swept, keyed by `(eventId)`).
- **Events in.** `workout.logged.v1`.
- **Events out.** `progress.level_up.v1`, `streak.broken.v1`, `streak.frozen.v1`.
- **Decision.** The 2026-11-02 overnight rebuild moved this service from Cloudflare Workers + D1 to AWS Lambda + DynamoDB. Bridging the shared `gym-events` EventBridge bus to a Worker would mean a paid API Gateway hop or a Lambda relay, neither of which fits the zero-cost rule. See `services/progress/README.md` for the full rationale, streak and freeze rules, and the local-date resolution via `Intl.DateTimeFormat`.

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

## Design patterns in use

Every service and app in this repo is written against the following patterns. New behaviour is added as a new class in a new file; existing working code is not edited to extend it (open/closed). This section is the reviewer's map: before changing a file, read the row here to see what the file is playing in the design.

### Strategy

Pluggable rules selected at runtime by a key rather than by a type switch. Adding a new variant is a new file, never an edit.

- `services/progress/src/progress/XpRules.ts`, `FreezeRules.ts`, `StreakRules.ts`: each pure-function class is a self-contained scoring strategy. The service composes them per event. Per-exercise XP rules move behind `ExerciseRegistry` in Stage 3b (see `packages/exercise-core`).
- `services/achievements/src/badges/*Rule.ts`: each badge is a `BadgeRule` strategy evaluated against the user's rolling snapshot. Adding "100 total squats" is a new file in `badges/`, never a branch inside a god method.
- `apps/pushup-counter/src/PushupRepCounter.ts` becomes a `RepCounter` driven by a `RepDetector` strategy once `packages/exercise-core` lands; the push-up detector moves to `packages/exercise-pushup`.

### Registry / Factory

A small lookup table that maps a stable string id to a strategy instance, with a factory responsible for seeding the default set. Keeps call sites ignorant of the concrete types.

- `packages/exercise-core/src/ExerciseRegistry.ts` (Stage 3b): maps `exerciseId` to an `Exercise` with its rep detector, XP rule and target rule. `ExerciseRegistryFactory` seeds the default registry. Tests register test-only exercises without touching the factory, proving open/closed.
- `services/achievements/src/badges/BadgeRegistry.ts`: holds every `BadgeRule`. The consumer evaluates them in order on every event.

### Repository (Ports and Adapters)

A pure-domain interface in the service's domain folder, with the infrastructure driver in the same folder. The service depends only on the interface; tests swap in an in-memory fake.

- `services/logging/src/workouts/{WorkoutRepository,DynamoWorkoutRepository}.ts`
- `services/logging/src/idempotency/{IdempotencyRepository,DynamoIdempotencyRepository}.ts`
- `services/progress/src/progress/{ProgressRepository,DynamoProgressRepository,DynamoProcessedEventRepository}.ts`
- `services/catalogue/src/exercises/{ExerciseRepository,D1ExerciseRepository}.ts`
- `services/media/src/media/{MediaRepository,R2MediaRepository}.ts`
- `services/achievements/src/achievements/{AchievementRepository,D1AchievementRepository}.ts`
- `services/auth/src/users/{UserRepository,...}`, `services/auth/src/sessions/{SessionRepository,...}`

### Adapter

Infrastructure wrapper that keeps a third-party SDK or primitive at the edge so the core never imports the SDK.

- `services/*/src/events/{EventPublisher,EventBridgeEventPublisher}.ts` wraps `@aws-sdk/client-eventbridge`.
- `services/auth/src/mail/{Mailer,NodemailerMailer}.ts` wraps Gmail SMTP.
- `services/*/src/util/{Clock,SystemClock}.ts` and `{IdGenerator,UuidIdGenerator}.ts` keep `Date.now()` and `randomUUID()` out of domain code so tests get a deterministic clock.
- `services/*/src/tokens/{JwtVerifier,JwksJwtVerifier}.ts` wraps `jose`.
- `apps/pushup-counter/src/MediaPipePoseSource.ts` implements `PoseSource` on top of `@mediapipe/tasks-vision`.
- `apps/web/src/api/FetchHttpClient.ts` implements `HttpClient` on top of `fetch`.

### Observer (via versioned events)

Cross-service communication is strictly asynchronous via `@gym/contracts` event schemas on EventBridge. No service imports another's domain code; subscribers are observers on the bus.

- `services/logging` publishes `workout.logged.v1`.
- `services/progress` observes `workout.logged.v1`; publishes `progress.level_up.v1`, `streak.broken.v1`, `streak.frozen.v1`.
- `services/achievements` observes `workout.logged.v1` and `progress.level_up.v1`; publishes `achievement.unlocked.v1`.

### Dependency Injection

Every service class takes its collaborators through its constructor as a `Deps` interface. Nothing calls `new` on its own collaborators except at the composition root (the per-lambda runtime factory or `*Worker.ts` entry point).

- `ProgressService`, `LoggingService`, `AuthService`: all take a `Deps` object.
- Composition roots: `services/progress/src/service/ProgressRuntimeFactory.ts`, `services/logging/src/service/LoggingServiceFactory.ts`, `services/auth/src/service/AuthServiceFactory.ts`, `services/catalogue/src/CatalogueWorker.ts`, `services/media/src/MediaWorker.ts`, `services/achievements/src/AchievementsWorker.ts`.

### Layering (domain / handler / lambda-or-worker)

Every TS service is three layers:

1. **Domain** (`service/`, plus whatever folders the bounded context needs). Pure code. Takes repositories and adapters through interfaces.
2. **Handler** (`handlers/`). One class per endpoint. Reads headers, validates with Zod, maps service errors to HTTP responses, returns `APIGatewayProxyStructuredResultV2`.
3. **Lambda or Worker entry** (`lambdas/` on AWS, `*Worker.ts` on Cloudflare). Wires the composition root once per cold start and dispatches to the handler.

No handler calls an SDK directly; no domain class returns an HTTP response. The folder tree is the design.

### Known violation to be fixed

The `workoutKindSchema` in `packages/contracts/src/events/workoutLogged.v1.ts` is a closed enum of `['set', 'pushup']`. `ProgressService.foldEventIntoSummary` and `XpRules.baseXpForEvent` branch on this enum. That is a type switch standing in for a strategy. The fix is `packages/exercise-core` (new abstraction) plus `packages/exercise-pushup` (first strategy) plus a loosened schema that validates against the registry. See `docs/roadmap.md` and the upcoming `bongani/exercise-model` PR.

## Planned features

The living backlog of planned features, which service owns each one, and the events they will consume or emit lives in `docs/roadmap.md`. Add rows there before any new feature work starts.

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
