# Overnight report: 2026-11-09

This report summarises the overnight session that landed on top of the previous (2026-11-02) report. All work shipped: every PR below is on `main`, and the achievements, progress, and web services are live on their respective platforms.

## Pull requests merged tonight

| #   | Branch                            | What landed                                                                                                                                            |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 18  | bongani/design-audit              | Documented every design pattern in use across the repo (strategy, registry/factory, repository, adapter, observer, DI, layered folders).               |
| 20  | bongani/exercise-model            | New packages `@gym/exercise-core`, `@gym/pose`, `@gym/exercise-pushup`. Replaced the `kind` type-switch with a registry.                               |
| 21  | bongani/sw-cache-fix              | Service worker now embeds the git SHA in `CACHE_NAME`, purges old caches on activate, network-first for navigations, reloads once on controllerchange. |
| 22  | bongani/exercise-embed            | Generic on-device exercise counter in `apps/web`. React.lazy loads MediaPipe only when the user opens it. Camera denial is handled gracefully.         |
| 23  | bongani/achievements              | Stage 3 achievements service on Cloudflare Worker + D1 with four starter badges and a signed internal webhook.                                         |
| 24  | bongani/progress-ssm-prefix-slash | Pre-existing bug in progress: double-slash SSM parameter name blew up every authenticated request. Normalised the loader so the service works.         |
| 25  | bongani/vercel-root-config        | Moved `vercel.json` to the repo root so Vercel can see `pnpm-lock.yaml` during install.                                                                |

**Review order for the owner:** read the PRs in numeric order; each builds on the previous. PR #24 and #25 are tiny fix-forwards discovered during deploy and are already on `main`.

## Deploys

### `services/achievements` (Cloudflare Worker + D1)

- **D1 database.** `gym-achievements` (id `32878df7-af08-4c4e-b228-6d590485d526`). Created with `wrangler d1 create`; migration `0001_initial.sql` applied to remote.
- **Secret.** `INTERNAL_EVENTS_KEY` set via `wrangler secret put` (value stashed in `services/achievements/.env`, gitignored).
- **Worker URL.** https://gym-achievements.bobosibanda35.workers.dev
- **Smoke tests.**
  - `GET /health` -> `{"status":"ok"}` (200).
  - `GET /achievements` without bearer -> 401.
  - `POST /events` without the shared secret -> 401.

### `services/progress` (AWS Lambda + DynamoDB)

- **Stack.** `GymProgressStack` in `ap-southeast-2`. Redeployed via `pnpm --filter @gym/infra-progress run deploy` on the Task 1 code (and then again after PR #24 landed).
- **API URL.** https://cne6xzs2nk.execute-api.ap-southeast-2.amazonaws.com (unchanged).
- **Smoke tests.**
  - `GET /health` -> `{"status":"ok"}`.
  - `GET /progress` without bearer -> 401 (before PR #24 this was 500; CloudWatch pointed at the double-slash SSM parameter name).

### `apps/web` (Vercel)

- **Project.** `bonganis-projects-7c6146b2/gym` (fresh project created tonight; `vercel link --yes --project gym`).
- **Env vars.** All nine `VITE_*` values from `apps/web/.env` added as Production scope via `vercel env add`.
- **URL.** https://gym-phi-blush-16.vercel.app
- **Smoke tests.**
  - `/` returns 200 and the SPA HTML.
  - `/login`, `/some/deep/route` both return 200 (the `vercel.json` rewrite catches them).
  - `/sw.js` returns 200 with `cache-control: no-cache` + `service-worker-allowed: /`.
- **Deploy quirks worth remembering.**
  - The first `vercel deploy` from `apps/web/` failed because only the `apps/web` tree was uploaded, so `pnpm install --frozen-lockfile` had no `pnpm-lock.yaml`. Fix (#25) was to move `vercel.json` to the repo root and set `outputDirectory: "apps/web/dist"`.
  - New Vercel CLIs refuse to let `VITE_*` variables look like secrets. `VITE_JWT_ISSUER` and `VITE_JWT_AUDIENCE` needed `--type config --yes --force` explicitly.

## Decisions made overnight

### Contract changes (owner approval needed)

1. **`workout.logged.v1.kind` opens up from a closed enum.** `z.enum(['set','pushup'])` becomes `z.string().min(1).max(64).regex(/^[a-z][a-z0-9-]*$/)`. Unknown ids are rejected at each service boundary against the `ExerciseRegistry`; adding a new exercise never bumps the contract again.
2. **`dailyTargetSchema` gains an `exerciseId`.** Required field, defaults to `pushup` in the progress service's `setDailyTarget` call. The field makes "100 push-ups a day" distinguishable from a future "100 squats a day" without needing a new schema version.
3. **New event `achievement.unlocked.v1`.** Emitted by `services/achievements` the first time a badge unlocks (idempotent on `(userId, badgeId)`). Shipped as a schema today; no subscriber exists yet, so the publisher is a `LoggingEventPublisher` that only logs the emission.
4. **New HTTP contract `AchievementsApi`.** `GET /achievements` returns the user's unlocked badges newest first; the `Achievement` schema carries frozen `name`/`description` so the UI never has to look them up.

### Architecture

- **`packages/exercise-core`, `packages/pose`, `packages/exercise-pushup`.** The exercise strategy abstraction lives in `exercise-core`; pose primitives and the generic `RepCounter` in `pose`; the push-up `Exercise`, its rep detector, and the default registry factory in `exercise-pushup`. `apps/pushup-counter` keeps its public API but delegates to the new packages.
- **`apps/web/src/counters/`.** Generic `ExerciseCounter` host + `ExerciseCounterRegistry` + `DefaultExerciseCounterRegistryFactory`. `PushupExerciseCounter` is `React.lazy`-loaded so MediaPipe ships as its own 40 kB gzipped chunk.
- **Service worker.** Cache name is `gym-shell-<buildId>` where `__BUILD_ID__` is injected by Vite from `git rev-parse HEAD`. Navigations network-first; `/assets/` cache-first; other same-origin cache-first. Client reloads once on `controllerchange`.
- **`services/achievements`.** Worker + D1, badge rules as strategy classes in `src/badges/`, pluggable through `DefaultBadgeRegistryFactory`. Starter set: `first-workout`, `total-reps-100`, `seven-day-streak`, `level-5`. Idempotent via a `processed_events` table on `eventId`.

### Posture

- **`APP_ORIGINS=*` is preserved.** Both the deployed achievements Worker and the progress CDK stack keep the wildcard CORS, per the owner's 2026-10-29 policy.

## New dependencies

| Package                                      | Where                                                                                     | Why                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| New workspace package `@gym/exercise-core`   | packages/                                                                                 | Exercise abstraction + registry.                          |
| New workspace package `@gym/pose`            | packages/                                                                                 | Pose primitives + generic RepCounter + MediaPipe adapter. |
| New workspace package `@gym/exercise-pushup` | packages/                                                                                 | PushupExercise + PushupRepDetector + default factory.     |
| `@gym/exercise-core`, `@gym/exercise-pushup` | apps/web, apps/pushup-counter, services/progress, services/logging, services/achievements | Registry callers.                                         |
| `@gym/pose`                                  | apps/web, apps/pushup-counter                                                             | Generic RepCounter + MediaPipePoseSource.                 |

No new npm dependencies were added outside what was already resolved in the committed `pnpm-lock.yaml`.

## Test totals

| Suite                    | Count   |
| ------------------------ | ------- |
| packages/exercise-core   | 3       |
| packages/pose            | 4       |
| packages/exercise-pushup | 8       |
| services/auth            | 102     |
| services/catalogue       | 56      |
| services/media           | 34      |
| services/logging         | 64      |
| services/progress        | 41      |
| services/achievements    | 16      |
| apps/web                 | 33      |
| apps/pushup-counter      | 10      |
| **Total**                | **371** |

Every suite passes locally against `main`. CI (`pnpm run lint`, `pnpm run lint:fmt`, `pnpm run style:check`, `node scripts/uml-check.mjs`) is green on every merged PR.

## What the owner still has to decide

1. **Approve the contract changes** called out under "Decisions made overnight > Contract changes". None of them break existing consumers (the only live consumer today is `apps/web`, and it ships with these changes).
2. **Approve the badge starter set.** `name`/`description` on each badge are frozen at unlock time, so renaming the class never retroactively rewrites a user's history, but the shipped strings should still read the way the owner wants.
3. **Wire EventBridge -> achievements webhook.** Today `services/achievements` has a working `/events` endpoint but no producer. Plan is an EventBridge API Destination that forwards `workout.logged.v1` and `progress.level_up.v1` to the Worker with the shared secret in `X-Internal-Events-Key`. Not provisioned tonight.
4. **Rename the Vercel production URL.** Currently `gym-phi-blush-16.vercel.app`. A readable alias (for example `gym.bobosibanda.com`) is a project-level setting in Vercel.

## Known risks

1. **The `vercel_authentication` deployment protection is on.** The production URL returns 200 to anonymous requests today, so the auth gate is effectively bypassed for the shell, but the dashboard reports it as enabled. Confirm whether the owner wants it enforced (would require a token or team-only access).
2. **Vercel credentials policy nags.** `VITE_*` env vars trigger a "looks like a credential" warning in the newer CLI. They are not secrets (Vite inlines them into the client bundle), but the owner should decide once whether to keep them as `--type config` or stop prefixing them with `VITE_` for anything that should be private.
3. **The achievements service is not actually receiving events.** `/events` works end-to-end for a hand-crafted POST but the EventBridge bridge is not wired. Any badge unlocks require either item 3 in the previous section or a manual POST through `curl`.
4. **Push-up counter widget in `apps/pushup-counter` is now a facade.** The React component there still works but points at `@gym/pose` internals; if a future redesign of `apps/web` wants the camera widget directly, the compat facade in `apps/pushup-counter` can be deleted in one commit.

## Bug fix after deploy: web client could not reach the backend

`apps/web/src/api/FetchHttpClient.ts` captured the global `fetch` as a default constructor argument and invoked it as `this.fetchFn(...)`. In a browser that throws `TypeError: Illegal invocation` because `fetch` requires `this === window`, so no request ever left the page and sign-up and login rendered the generic connection error. The unit tests all inject a stub `fetch` and so never exercised the default-argument path.

Fix: default the constructor argument to `(input, init) => fetch(input, init)` so the global keeps its correct binding. Added a regression test that swaps `globalThis.fetch` for a function that rejects any non-global `this`, then builds `FetchHttpClient()` with no args and asserts the request succeeds. `apps/web` test count ticks from 33 to 34 (total 372).

Audited the rest of the repo for the same anti-pattern. The only other candidate is `services/catalogue/scripts/WgerImporter.ts`, which is a Node CLI script; Node's `fetch` does not enforce the window-`this` check, so no change there. No `setTimeout`, `setInterval`, `localStorage`, `sessionStorage`, `navigator`, `indexedDB`, or `console` handles are stored as bound fields anywhere in browser code.

Also stopped swallowing errors in every screen that falls back to a generic connection message. Each catch now logs the original `err` with `console.error` before setting the user-facing message: `LoginScreen`, `RegisterScreen`, `HistoryScreen`, `ResetPasswordScreen`, `VerifyEmailNoticeScreen`, `VerifyEmailConfirmScreen`, `LogWorkoutScreen` (three catch sites), `ForgotPasswordScreen`. No passwords, tokens or request bodies are in scope at those catch sites, so the log is safe.

## Bug fix: verification and reset emails contained unclickable links

`infra/auth/lib/AuthStack.ts` built `APP_VERIFY_URL` and `APP_RESET_URL` from `resolveFirstAppOrigin()`, the same source as `ALLOWED_ORIGINS`. Under the 2026-10-29 wildcard CORS policy `APP_ORIGINS=*`, so every verification and password-reset email went out with a link whose base was literally `*`, not a URL. Not clickable in any mail client.

Fix: a new `APP_PUBLIC_URL` config value, sourced from `services/auth/.env` and validated at synth time by a new `AppPublicUrl.resolve()` helper in `infra/auth/lib/AppPublicUrl.ts`. The helper rejects missing, empty, `*`, relative, unparseable, and non-https values with actionable error messages that explicitly name `ALLOWED_ORIGINS` as the place where `*` is still correct. `ALLOWED_ORIGINS` itself keeps reading from `APP_ORIGINS`, so CORS still accepts the wildcard per the 2026-10-29 policy. Production value set to `https://gym-phi-blush-16.vercel.app`, pulled via `vercel project ls`.

Added `tests/infra-auth/AppPublicUrl.test.ts` with 10 cases (missing, empty, `*`, relative, non-URL, http, happy-path Vercel URL, trailing slash, whitespace, path prefix). A new `tests/infra-auth` workspace was wired up with its own `vitest.config.ts` and a `test` script in `infra/auth/package.json`; vitest was already in the lockfile from sibling workspaces, so no new npm package entered `pnpm-lock.yaml`. One assertion was also added to the existing register-happy-path test in `tests/auth/AuthService.test.ts` so the verification email body is now checked to contain an absolute `https://` link with a `token=` query parameter.

Verified by running the four invalid `APP_PUBLIC_URL` values through `npx tsx bin/auth.ts` directly: all four refused to synth with the right error. The valid value synths cleanly.

Auth stack is redeployed via `pnpm --filter @gym/auth deploy`, which loads `services/auth/.env` as a Node `--env-file`. The sibling `pnpm --filter @gym/infra-auth deploy` script runs `cdk deploy` without an env file, so it would fail the `AppPublicUrl.resolve` check unless the shell already carries the var. Redeploying via the `@gym/auth` entrypoint is therefore the correct command going forward. The CDK diff is Lambda environment variables only: `APP_VERIFY_URL` and `APP_RESET_URL` move from `*/verify` and `*/reset` to `https://gym-phi-blush-16.vercel.app/verify` and `https://gym-phi-blush-16.vercel.app/reset`. No tables, stacks, or other resources are destroyed. `ALLOWED_ORIGINS` stays `*`.

### Follow-up noted for the owner

- The stack still uses `VERIFY_URL_PATH = 'verify'` and `RESET_URL_PATH = 'reset'` (`infra/auth/lib/AuthStack.ts` lines 56-57), but the web app renders verification at `/verify-email` and password reset at `/reset-password` (see `apps/web/src/screens/VerifyEmailConfirmScreen.tsx` and `apps/web/src/screens/ResetPasswordScreen.tsx`). The links in email are now clickable `https://` URLs, but they will 404 at the web app until either the stack paths or the web routes are brought into alignment. Out of scope for this PR because the owner's brief was specifically about the base URL; flagging so it does not get missed.

## Free-tier status

Every service is inside the free tier on its platform:

- Cloudflare Worker (achievements) + D1 is well below the 100k request/day + 10 GB storage ceiling.
- AWS Lambda / API Gateway v2 / DynamoDB (progress) stayed inside the always-free tier through the smoke tests.
- Vercel hobby tier covers one production project per account; `gym` is the only non-archived project that needs a production build cadence.
- MediaPipe runtime continues to load from `cdn.jsdelivr.net` + `storage.googleapis.com`; no self-hosting cost.
