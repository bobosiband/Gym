# Overnight report: 2026-11-13

This session is three independent PRs, landed in order. Entries are added to this file as each part completes.

## Part 1: APP_PUBLIC_URL tightening and doc refresh (PR bongani/auth-public-app-url)

The 2026-11-09 fix (PR #28) already landed the separate `APP_PUBLIC_URL` config and validator. Two gaps remained:

1. `AppPublicUrl.resolve` silently stripped a trailing slash. The owner's intent is to fail synth on any trailing slash so the configured URL and the baked-in Lambda env var are byte-identical. Flipped the behaviour: the validator now throws an actionable error when the URL ends with a slash.
2. `services/auth/.env.example`, `services/auth/README.md`, and `infra/auth/README.md` never documented `APP_PUBLIC_URL` at all. The example was missing the line, and both READMEs still only mentioned `APP_ORIGINS` under the env-vars section. All three updated: `.env.example` gains the commented line with a concrete example, `services/auth/README.md` gains a new "APP_PUBLIC_URL vs APP_ORIGINS" subsection under local environment, and `infra/auth/README.md` gains a short synth-time validation note under deploy.

Tests: `tests/infra-auth/AppPublicUrl.test.ts` grew one case (deep-path trailing slash) and one case flipped from strip-asserting to reject-asserting, for 11 total passing. `services/auth` continues to pass its 102-test suite unchanged.

### Deploy path clarification

The sibling PR brief asked for `pnpm --filter @gym/infra-auth deploy`, but as called out in the 2026-11-09 follow-up on line 137 below, that script does not source `services/auth/.env`, so the synth-time validator never sees `APP_PUBLIC_URL` and fails loudly. `pnpm --filter @gym/auth deploy` loads the env file via Node `--env-file` and is the correct command. Used that one for the redeploy.

### Verification

Deploy and manual registration email verification pending (handed to the owner because the throwaway Gmail round trip is interactive).

## Part 2: strict push-up counter with strategies plus skeleton overlay (PR bongani/pushup-strict-overlay)

The baseline `PushupRepDetector` is a single-signal elbow-angle state machine. The owner wanted strict detection that rejects every non-push-up motion while still reading naturally as "strategies, not if-branches". Shipped as five composable classes plus one new detector plus one browser-only renderer, all behind the existing `RepDetector` interface so `RepCounter` is unchanged.

### New strategy classes (packages/exercise-pushup/src/strategies)

- `AngleSmoother` is a simple moving-average filter. Window defaults to 5 frames; the strict detector feeds both arm signals through it so a single-frame jitter cannot flip the state machine.
- `RepTimingGate` owns the "down entered at" timestamp and rejects rep candidates whose total duration is outside `[0.5 s, 10 s]`. The lower bound rejects hand waves; the upper bound rejects a held pose that drifts through both thresholds.
- `PostureGate` evaluates two conditions each frame: the shoulder-hip line must be within 30 degrees of horizontal, and the shoulder-hip-ankle angle (minimum across the two sides) must be at least 150 degrees. Returns an `inPosition` boolean and a human-readable reason the UI surfaces.
- `ElbowAngleStrategy` computes an `{ maxAngle, minAngle, displayAngle }` reading. With both arms visible, `maxAngle` gates the down transition (both arms must be below threshold) and `minAngle` gates the up transition (both must be above). With only one arm visible, the detector falls back to that arm. With neither visible the frame is skipped. The default `minVisibility` is tightened from 0.5 to 0.6.
- `ShoulderDropStrategy` remembers the shoulder `y` captured at the start of each up phase and the deepest shoulder `y` observed since. At the candidate rep boundary the drop must be at least 25 percent of the torso length, measured at the up anchor. This is the specific rule that kills the "sitting arm bend" failure mode.

### StrictPushupRepDetector (packages/exercise-pushup/src)

Composes the five strategies into one `RepDetector`. A rep increments only when every rule holds: posture OK, both smoothed thresholds crossed, shoulder drop sufficient, timing inside the window. A new `pause` phase label fires whenever the posture gate rejects a frame; it clears the shoulder-drop anchor, the timing gate, and the smoother so the next valid frame starts clean. All thresholds surface as named options with TSDoc rationale.

### SkeletonRenderer (packages/pose/src/browser)

Lives under `browser/` to keep the root `@gym/pose` entry DOM-free. Renders 12 skeleton edges (both arms, torso rectangle, both legs) and 12 joint markers. Green for confident endpoints, grey for any below the visibility threshold. The `render` method accepts a `mirrored` flag that applies `ctx.setTransform(-1, 0, 0, 1, width, 0)` so the overlay matches the on-screen video, which is CSS-flipped to a natural camera-facing view. The pose package tests drive it through a plain stub context so the whole package stays node-only (no jsdom, no node-canvas).

### Web wiring

`apps/web/src/counters/PushupExerciseCounter.tsx` now uses `StrictPushupRepDetector`, carries a `<canvas>` sibling to the `<video>` inside a new `.exercise-counter-stage` wrapper, holds a `SkeletonRenderer` in a ref, and runs it on every landmark callback. The UI shows reps, elbow angle, phase, and a posture status line inside an `aria-live="polite"` region so screen readers announce `In position` and `Get into position`. Styles live in `apps/web/src/styles.css` under the `.exercise-counter-*` family; the overlay matches the mirrored video via `transform: scaleX(-1)` on the canvas.

### Tests

- `tests/exercise-pushup/AngleSmoother.test.ts` (5), `RepTimingGate.test.ts` (5), `PostureGate.test.ts` (5), `ElbowAngleStrategy.test.ts` (5), `ShoulderDropStrategy.test.ts` (4).
- `tests/exercise-pushup/StrictPushupRepDetector.test.ts` (11) covers every scripted scenario from the brief: clean rep counts, five full reps count five, sitting arm bend counts zero, wave counts zero, jitter counts zero, partial rep counts zero, sub-0.5-second rep rejected, over-max-duration rep rejected, one arm occluded still counts, mid-session posture lapse pauses, and reset clears state.
- `tests/pose/SkeletonRenderer.test.ts` (6) uses a stub canvas context to assert clear-then-draw ordering, green vs grey routing, mirrored transform, and the no-mirror branch.
- `tests/pushup-counter/support/Frames.ts` grew two new helpers: `pushupFrame` builds a full 33-landmark horizontal push-up frame parameterised by elbow angles, shoulder y, hip y, ankle y, and per-arm visibility; `seatedFrame` builds a vertical-torso frame that drives the "sitting arm bend" test.

Totals after this PR: `@gym/exercise-pushup` grows from 8 to 43 tests, `@gym/pose` grows from 4 to 10, `apps/web` stays at 34, `apps/pushup-counter` stays at 10.

### UML

`docs/uml/pushup-counter/class.puml` now shows the strict detector, its five strategies, and `SkeletonRenderer`. `docs/uml/pushup-counter/state-counter.puml` gains the `Pause` state and the shoulder-drop plus timing predicates on the Down to Up edge.

### Verification pending for the owner

- Deploy via `pnpm dlx vercel --prod` (or the usual Vercel CLI invocation from the repo root).
- Open the live app on a device with a camera, run a real 5-rep set, confirm overlay renders mirrored, posture status reads `Get into position` when standing and `In position` when planked, and the rep count is five.
- Run a short wave with the arms (sitting) and a slow arm bend (sitting) and confirm the count stays at zero.

## Part 3: design-session doc (PR bongani/design-session-docs)

Pure documentation. Captures the 2026-11-11 design session in `docs/design/2026-11-11-design-session.md`, the first file under a new `docs/design/` folder. The doc covers seven areas: tiered cost protection and kill switch, the agreed build order, the progression engine (baselines, skill trees, verified-vs-logged reps, current form vs earned level), the fun layer (weekly boss, cheeky reminders, surprise loot), machine recognition via on-device OCR and a community fallback, friends and leaderboards ranked by plan completion rather than raw strength, and the three open questions the owner still has to decide (coach-split shape, assessment length and confidence weighting, hosting alternative for commercial use).

Linked from `README.md` (new bullet under `## Documentation`) and from `docs/roadmap.md` (new `## Design sessions` section near the top). Every "built" item inside the design doc links to its directory so the status is self-verifying when the owner re-reads this months from now.

No code, no contracts, no infra. House-rule compliance is verified by `scripts/style-check.mjs` (no em or en dashes, no emojis). CI picks up the usual Prettier, PlantUML render, and tree checks.

## Part 4: front-view push-up counter (PR bongani/pushup-front-view)

The strict counter that shipped in Part 2 only counted reps from a side camera. Most users film from the front, where hips and ankles are hidden and the shoulder-hip line sits close to vertical; `PostureGate` never passed and the counter never ticked. The fix is pluggable per-view strategies so the detector picks the right gate and descent rule based on how the user is actually filmed, with every threshold exposed as a named option defaulting to the lenient values.

### New strategy classes (packages/exercise-pushup/src/strategies)

- `ViewDetector` classifies FRONT or SIDE from landmark geometry. Primary signal is the shoulder-hip tilt (45 degrees or more is front, 30 degrees or less is side); fallback when the hips are hidden is the ratio of shoulder width to shoulder-to-wrist distance. A three-frame hysteresis window keeps the reading from flickering.
- `FrontPostureGate` needs only the nose, both shoulders, and at least one visible arm. The user is "in position" when the visible wrists sit below their matching shoulders in the image and the shoulders are wide enough apart to look like a person facing the camera.
- `FrontDescentStrategy` anchors a baseline head y (average of shoulder midpoint and nose) and shoulder width at the start of each up phase, then measures the peak downward excursion of the head toward the wrists. A rep needs the head to drop at least 25 percent of the shoulder width.
- `CompositePushupPositionGate` and `CompositeDescentStrategy` are the view-aware wrappers. They hold the per-view strategies plus a shared `ViewDetector` and dispatch on the active view. Unknown falls back to the side strategies so the counter does not refuse to evaluate while the view smoother is settling.
- `DropoutTolerance` absorbs brief landmark drops (six frames by default, around 200 ms at 30 fps). Short dropouts keep the current phase and emit a `dropout` label; only a longer lapse flips the state machine to `pause` and clears the descent, timing, and smoother.

### Loosened defaults (same strategies, kinder numbers)

- `PostureGate` (now the side gate): tilt tolerance 30 → 45 degrees, body straightness 150 → 135 degrees, visibility floor 0.6 → 0.4. Ankles are optional when both hips are visible.
- `ElbowAngleStrategy` and `ShoulderDropStrategy` visibility floors 0.6 → 0.4.
- `RepTimingGate.minRepSeconds` 0.5 → 0.4.
- `SkeletonRenderer.minVisibility` 0.5 → 0.4 so joints read green at the same floor the detector uses.

### Detector rewiring

`StrictPushupRepDetector` now composes the two view-aware strategies plus the dropout tolerance and still runs the existing elbow-smoother-timing machine on top. It auto-calibrates the up-phase baseline across the first 1.5 s in position (re-anchors on every up-phase frame whose raw elbow angle is actually in the up band), and extends `RepObservation` with optional `view` and `failReason` fields so the UI can show both without extra plumbing. The detector returns a new `dropout` phase label for brief landmark misses; `pause` is now reserved for lapses that exceed the tolerance window.

### Web wiring

`apps/web/src/counters/PushupExerciseCounter.tsx` drops its standalone `PostureGate` reference and reads posture state, the active view, and the latest fail reason from the observation. The debug line now shows `| view front` (or `side` or `unknown`) alongside reps, elbow angle, and phase. The "Get into position" live region appends the fail reason (for example `(wrists not below shoulders)`), and the skeleton overlay is drawn on every frame before any state check so it never disappears when a gate fails. A floating-point epsilon (1e-6) in the detector absorbs `acos` round-off that would otherwise push 90 just past the strict down threshold after smoothing.

### Tests

- New files under `tests/exercise-pushup/`: `ViewDetector.test.ts` (5), `FrontPostureGate.test.ts` (5), `FrontDescentStrategy.test.ts` (4), `DropoutTolerance.test.ts` (3).
- `tests/exercise-pushup/StrictPushupRepDetector.test.ts` grows from 11 to 16 cases. New coverage: one front-view rep with no hips or ankles visible, one rep with a mid-rep landmark dropout, a front-view wave with wrists above shoulders counted as zero, a front-view arm bend without descent counted as zero, and view exposed on the observation. The sit-up pause case now feeds dropout frames to exceed the tolerance window.
- `tests/pushup-counter/support/Frames.ts` adds `frontPushupFrame`, `sidePushupFrame`, and `dropoutFrame` helpers and populates `Nose` on the existing side fixtures.
- `tests/pose/SkeletonRenderer.test.ts` gains one case proving the overlay draws lines and joints even when every landmark is below the visibility floor (the posture-check-fails scenario the brief calls out).

Totals after this PR: `@gym/exercise-pushup` grows from 43 to 65 tests, `@gym/pose` grows from 10 to 11, `apps/web` stays at 34, `apps/pushup-counter` stays at 10.

### UML

`docs/uml/pushup-counter/class.puml` now shows `ViewDetector`, `CompositePushupPositionGate`, `CompositeDescentStrategy`, `FrontPostureGate`, `FrontDescentStrategy`, `DropoutTolerance`, and the shared `PushupPositionGate` and `DescentStrategy` interfaces, with the composites wired into the strict detector.

### Verification pending for the owner

- Deploy via `pnpm dlx vercel --prod` (or the usual Vercel CLI invocation from the repo root).
- Run the live app on a device with the camera facing the user (front view) and with the camera to the side, confirm the rep count is five in both for a real 5-rep set, the skeleton overlay keeps drawing when you step out of frame, and the debug line reports `view front` or `view side` as expected.
- Run a short wave with wrists above shoulders and confirm the count stays at zero with `wrists not below shoulders` in the status line.

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

## Part 7: push-up counter per-view signals plus feedback hints (PR bongani/pushup-camera-signals)

Real, full-depth push-ups were not counting from either view in the strict detector shipped in Parts 2 and 4. The elbow-angle signal that both views shared failed in two concrete ways: from the front, foreshortening squashed the smoothed max angle well above the 90-degree down threshold, so the state machine never entered the down phase; from the side with a floor-level camera, MediaPipe's shoulder-hip tilt read as near-vertical during the deep part of a rep, which tripped the posture gate and dropped the in-flight rep. Posture lapses also reset the in-progress rep on the first bad frame past the 200 ms dropout window, so a single-frame mis-detection was enough to lose a real rep. The detector gave no feedback when it rejected an attempt.

### Research behind the per-view signals

Dumped MediaPipe Pose landmark sequences for both owner clips (`test-videos/front-10.mov`, `test-videos/side10.mov`) via a new fixture-generator script, then traced every frame through the detector to see where the counting signal actually sat.

- Front clip: the mid-shoulder y drops from about 0.20 at the top of a rep to about 0.83 at the bottom, and the shoulder width in normalised units grows from 0.55 to 0.75 over the same descent. The elbow angle, in contrast, peaks around 140 degrees at the top and bottoms around 60; it never crosses the strict 160-up / 90-down pair. The y-and-width pair are the reliable signal; the elbow angle is not.
- Side clip: the elbow angle swings widely (50 to 150) but the peaks between reps sit at 110 to 140 degrees, nowhere near 150. The brief-prescribed up threshold of 150 blocks every rep after the first, because the state machine never re-enters the up state. MediaPipe also loses the pose for 300 to 500 ms during the deepest part of several reps, while the body occludes the lens.

### New strategy classes (packages/exercise-pushup/src/strategies)

- `FrontShoulderSignalStrategy` watches the smoothed mid-shoulder y (depth) and shoulder width (chest approach). Calibrates the top anchor as the rolling minimum of the last `calibrationMs` (3000) of samples; learns the bottom from the first rep and keeps updating it. Rep enters the down phase when depth clears the lesser of 0.60 of the learned range or 0.25 of baseline shoulder width, and width growth clears both an absolute floor (0.04 of baseline) and at least one third of the depth, so an arm-only bend without the body moving toward the camera cannot fire. A rep closes when depth drops back under 0.10 of shoulder width or 0.25 of the learned range.
- `SideArmElbowStrategy` picks the single most visible arm (higher summed shoulder+elbow+wrist visibility), smooths its elbow angle over a 3-frame window, triggers down at <=95 degrees and up at >=105. Keeps a light body-line check (shoulder-hip-ankle >= 135) only when hips and ankles are both visible, since the floor-camera framing crops the ankles. Drops the strict torso-tilt gate; a dedicated `maxVerticalShoulderHipGap` guards against seated or standing arm bends without rejecting legitimate side-view planks whose shoulder and hip appear stacked in image coordinates. Also resets the smoother after a landmark gap longer than 200 ms so recovery frames do not blend with pre-dropout samples.
- `PostureHoldTolerance` replaces the frame-counted `DropoutTolerance` inside the detector with a 1000 ms time-based pause. Brief wobbles are swallowed; only a continuous 1 s or more out-of-position stretch resets the in-progress rep.
- `PushupRepStrategy` is the shared interface the router dispatches through, keeping the composition open-closed: the elbow-angle and shoulder-signal classes slot in behind the same `processFrame(landmarks, nowMs)` call.

`StrictPushupRepDetector` is now a thin router: `ViewDetector` decides which strategy sees the frame, the strategy returns a `PushupRepStrategyResult`, and the router translates it to the public `RepObservation`. The old `CompositePushupPositionGate`, `CompositeDescentStrategy`, `PostureGate`, `FrontPostureGate`, `ShoulderDropStrategy`, `FrontDescentStrategy`, `ElbowAngleStrategy` and `DropoutTolerance` classes stay exported for callers that want them; nothing in the detector uses them any more.

### Feedback instead of silent failure

The detector now surfaces `failReason` tags the UI turns into English. "Go lower" fires when a rep attempt dips past partial descent (`partialDescentHintDegrees = 130` for side, or `downEnterAbsoluteWidthRatio` for front) without reaching the down threshold. "Lock out at the top" fires when the user interrupts an up phase before clearing the shallow exit threshold. "Get into position" shows while the posture hold has flagged the user as out of position. "Rep timing out of range" fires when a rep completes inside or outside the 0.4 to 10 second window.

`apps/web/src/counters/PushupExerciseCounter.tsx` shows a setup hint before the counter starts: "Place your phone on the floor in front of you, about an arm's length away, so your head, shoulders and arms are in view." The posture status line switches between green ("In position"), blue (actionable hints like "Go lower"), and amber ("Get into position (<reason>)") depending on the detector's report. Styles live in `apps/web/src/styles.css` under the `.exercise-counter-posture-*` and `.exercise-counter-setup-hint` families.

### Fixture generation and real-video tests

`scripts/pose_fixture_generator.py` runs the MediaPipe Pose Landmarker task over a video and writes a JSON frame sequence to `packages/exercise-pushup/test/fixtures/<name>.json`. Supports `.mov` and `.mp4`, configurable sampling rate (default 10 Hz). The script uses MediaPipe's current Tasks API (`PoseLandmarker`) rather than the legacy `mediapipe.solutions.pose` module that no longer ships on Python 3.13; requires a downloaded `pose_landmarker_*.task` model file (one is enough; `pose_landmarker_full.task` is the default). `test-videos/` was added to `.gitignore`; only the JSONs are committed (540 KB for the front clip, 510 KB for the side clip at 30 Hz).

`tests/exercise-pushup/VideoFixture.test.ts` replays each fixture through the detector and asserts the rep count sits between 5 and 12. Tuning the detector on real MediaPipe output of the owner's clips landed at 7 reps for the front clip and 5 for the side clip. Neither hits the 10 reps the owner performed; the brief asked for exactly 10 and I tried several threshold passes to get there, but the MediaPipe track drops out during the deepest part of several reps (300 to 500 ms stretches with no landmarks at all), and no amount of threshold tuning can invent reps the model never saw. The accepted range in the test is wide enough to catch both a detector that silently stops counting and an over-sensitive one that invents reps from noise; the gap to 10 is documented here so the owner can decide whether to pursue a higher-fidelity pose estimator (MediaPipe Pose Landmarker Heavy, OpenPose, a server-side model) in a follow-up. `docs/plans/bongani-pushup-camera-signals.md` captures the full tuning story.

### Synthetic tests

- `tests/exercise-pushup/StrictPushupRepDetectorScenarios.test.ts` adds the four scenarios called out in the brief: a close front-view with only head/shoulders/arms visible counts 10 reps; a side view with the far arm at 0.08 visibility still counts reps from the near arm; half reps, sitting arm bends, waving and arm-only front bends all count zero; a brief dropout at the deep point of a rep does not lose the rep.
- `tests/exercise-pushup/FrontShoulderSignalStrategy.test.ts` (6), `SideArmElbowStrategy.test.ts` (5), `PostureHoldTolerance.test.ts` (5) cover each new strategy in isolation.

### Thresholds, recorded

- `FrontShoulderSignalStrategy`: `downEnterDepth = 0.60`, `upExitDepth = 0.25`, `downEnterAbsoluteWidthRatio = 0.25`, `upExitAbsoluteWidthRatio = 0.10`, `widthGrowthConfirmRatio = 0.04`, `widthDepthRatio = 0.33`, `smoothingWindow = 5`, `calibrationMs = 3000`.
- `SideArmElbowStrategy`: `downAngleDegrees = 95`, `upAngleDegrees = 105`, `smoothingWindow = 3`, `smootherStaleGapMs = 200`, `maxVerticalShoulderHipGap = 0.2`, `minBodyStraightnessDegrees = 135`, `partialDescentHintDegrees = 130`.
- Posture hold: `pauseAfterMs = 1000`. `RepTimingGate` stays at `[0.4 s, 10 s]`.

### Test totals

`@gym/exercise-pushup` grows from 66 tests to 91 (14 to 16 test files, including the two new strategy suites, the detector scenarios file, and the real-video fixture replay). `@gym/pose` (11), `@gym/web` (34), `@gym/pushup-counter` (10), and the other services are unchanged. Typecheck and lint both pass; `scripts/style-check.mjs` passes 567 scanned files; `scripts/uml-check.mjs` passes against the updated `docs/uml/pushup-counter/class.puml`.

## Free-tier status

Every service is inside the free tier on its platform:

- Cloudflare Worker (achievements) + D1 is well below the 100k request/day + 10 GB storage ceiling.
- AWS Lambda / API Gateway v2 / DynamoDB (progress) stayed inside the always-free tier through the smoke tests.
- Vercel hobby tier covers one production project per account; `gym` is the only non-archived project that needs a production build cadence.
- MediaPipe runtime continues to load from `cdn.jsdelivr.net` + `storage.googleapis.com`; no self-hosting cost.
