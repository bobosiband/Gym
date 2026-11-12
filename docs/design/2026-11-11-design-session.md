# Design session: 2026-11-11

Notes from an in-person design session. No code or infrastructure is changed in this file: it captures the direction the project is heading so cross-service work can be sequenced sensibly and the architecture docs can catch up later. The sister files `docs/architecture.md` and `docs/roadmap.md` stay authoritative for anything that is already implemented; this document is the living backlog of the ideas we intend to build.

The three live-session PRs (Part 1 auth link hardening, Part 2 strict push-up counter plus skeleton overlay, Part 3 this document) are called out at the bottom under "What this session delivered".

## Status key

- **Built** means a merged PR covers the item. Link follows.
- **In flight** means a PR is open against `main`.
- **Planned** means nothing has been written yet; implementation waits for owner approval.

## 1. Cost protection and tiered kill switch

Zero recurring cost is a non-negotiable (see rule 3 in the project `CLAUDE.md`). The design session nailed down a staged plan so the project survives a traffic spike or an exploited endpoint without the owner's card getting charged.

### On-device inference (built)

- Camera video and pose inference stay in the browser through MediaPipe Pose. See [`packages/pose`](../../packages/pose) and [`apps/web/src/counters/PushupExerciseCounter.tsx`](../../apps/web/src/counters/PushupExerciseCounter.tsx).
- The WebLLM coach (planned, Stage 5) will also run in-browser. Model distribution rides public free CDNs (jsDelivr, Hugging Face Hub).

### AWS Budget with a deny action (planned)

- One AWS Budget per account, threshold set a few dollars above forecast. Scope the Budget to the whole account so nothing new can slip past.
- Attach a Budget Action that applies an IAM deny policy to a dedicated "circuit breaker" IAM role. All deploy users are members of that role so a breach stops every CloudFormation operation.
- Notify the owner via SNS on every threshold crossing.

### Reserved concurrency and API Gateway throttling (planned)

- Every Lambda carries a `reservedConcurrency` cap set well above steady-state traffic and well under the free-tier concurrent executions ceiling. See the existing stacks under [`infra/`](../../infra) for the shape.
- Every API Gateway stage keeps a per-stage throttle (20 req/s burst 40 on auth today, see [`services/auth/README.md`](../../services/auth/README.md)) and tighter per-route throttles on the write endpoints.

### Short log retention (planned)

- 7-day CloudWatch log retention on every log group. The auth stack already sets 14 days (see `services/auth/README.md`); the session agreed to tighten that to 7 and roll it out to every CDK stack.

### DynamoDB inside the always-free tier (built, but worth revisiting)

- Current tables run in on-demand mode. The session agreed to switch the smaller tables to provisioned (25 WCU / 25 RCU shared across the account per AWS always-free) once traffic shape is known. No change for Stage 2 or 3; capture this as the moment to revisit.

### Tiered kill switch stack (planned)

A new CDK stack, independent of the service stacks, owns three tiers. Each tier is driven by a dedicated AWS Budget scoped to the account:

- **Tier 1 warning at about 50% of the limit.** SNS alert to the owner, no app changes.
- **Tier 2 throttle at about 80%.** The kill-switch stack lowers API Gateway stage throttling and Lambda reserved concurrency to roughly a quarter of their normal values. The app stays up but slower. Pre-change values are read from the current stacks and saved into an SSM parameter under `/gym/kill-switch/snapshot/` so the recovery can restore them exactly.
- **Tier 3 kill at 100% or if the spike continues.** All function concurrency is set to zero; API Gateway stage throttling is set to a tiny value (for example 1 req/s burst 1). The app returns 429 or 503 for every write path. Read paths that are served by Cloudflare Workers (catalogue, achievements) continue to work.

Every tier emits an SNS notification to the owner with the Budget reason.

Thresholds are set well above expected traffic so normal growth never trips Tier 3.

### Revive (planned)

- `pnpm revive` restores saved concurrency and throttling values from the SSM snapshot. The command is idempotent and refuses to run if the snapshot is missing. It does not undo the Budget alarm; the owner acknowledges that explicitly in the Budget console.

### Risks the session flagged

- 12-month AWS free tier expiry. Current account is under 12 months; every resource shape chosen should still be viable after the clock runs out. If something only fits inside the first-year free tier, call it out in the stack README.
- GIF bandwidth from Cloudflare R2. R2 egress to the public internet is free today; the achievement badges and exercise GIFs are the most bandwidth-heavy assets. Watch the R2 dashboard.
- Vercel Hobby. Commercial use is not permitted on Hobby. If the app ever opens to paid use, hosting must move. See the "Open questions" section for alternatives.

## 2. Build order

Reconfirmed in the session. Each step merges before the next starts.

1. **Cost protection and tiered kill switch (planned).** Must land before anything that could scale.
2. **Push-up counter fix (built in Part 2 of this session, PR #30).** Strict detection with strategy classes, skeleton overlay. See [`packages/exercise-pushup`](../../packages/exercise-pushup) and [`packages/pose/src/browser/SkeletonRenderer.ts`](../../packages/pose/src/browser/SkeletonRenderer.ts).
3. **Daily target, streaks, and story quests (progress: built; quests: planned).** The progress service ([`services/progress`](../../services/progress)) owns the first two; a new `services/quests` owns story quests and emits `freeze.granted.v1`. See `docs/roadmap.md` for the full detail.
4. **Gym coach (planned, Stage 4 and Stage 5).** The rule-based weekly split in `services/planner` goes first; the WebLLM `apps/coach` goes last. A finished coach session emits `workout.logged.v1` so it counts toward the daily target automatically and the streak extends without a separate code path.

## 3. Progression engine

The session agreed to anchor every number to the user's own baseline rather than an absolute scale. A new or returning user is never told they are "level 1" of an external leaderboard.

### Baselines

- The user runs 3 to 5 assessment sessions on first use. The baseline for each movement is the median of those sessions.
- After the final assessment session, the baseline is locked. Future sessions never retroactively rewrite history.
- The baseline is confidence-weighted. A median built from highly variable sessions is treated as a looser estimate than one built from tight sessions. The weight is used in two places: unlocking the next skill-tree node, and deciding whether a new set qualifies as a personal best.
- After a break of more than two weeks, the user is offered a recalibration. Recalibration produces a new baseline but keeps the full history of earned skill-tree nodes.

### Skill trees per movement

- One tree per movement family. For push-ups: knee, standard, archer, one-arm. For squats (planned): chair-assisted, bodyweight, pistol, one-leg.
- A node unlocks when the user demonstrates the ability. Every unlock is a camera-verified session (see "Verified vs logged"); no self-report unlocks a node.
- Earned levels never drop. If the user plateaus, the level stays; a separate "current form" score is allowed to dip.

### Current form vs earned levels

- "Earned level" is monotonic and reflects what the user has demonstrated. It appears in the achievements service ([`services/achievements`](../../services/achievements)) alongside badges like `level-5`.
- "Current form" is a decaying measure based on recent sessions. If it dips below a threshold, the user triggers a comeback quest. The comeback quest never lowers the earned level.

### Verified vs logged

- Reps counted via the push-up camera counter carry a `verified: true` tag on the log entry. The session agreed to carry this tag end-to-end so the UI can mark reps with a small badge.
- Resistance lifts are self-reported in `services/logging` today. We trust them, but `verified: false` makes it clear in the stats UI.

### Long-term strength graph (planned)

- A single chart per movement, time-series of best reps (and later: load, volume). Shows baseline, unlock thresholds, and personal bests. Rendered on-device from a normalised series owned by `services/stats` (Stage 4, planned).

## 4. Fun layer

Game-ish touches that only land after the mechanics (daily target, streaks, quests) are stable so the fun layer is decorating something real.

### Weekly group boss (planned)

- A weekly boss with a shared health bar scoped to a cohort (friends of a user, or an auto-generated group of ten strangers who opted in).
- Each rep logged against the boss's movement contributes to the group's shared HP. Shipping before friends and leaderboards is fine because the same scheduler and pull cadence apply.
- `services/social` (new) owns the group state. Tier 2 of the kill switch should scale this down first if traffic spikes.

### Cheeky coach reminders (planned)

- Reminders start friendly early in the day and escalate in tone as local midnight approaches. Content comes from a strict catalogue of pre-written lines so an inference failure never fabricates a cue (see the retrieval rule in `CLAUDE.md`).
- Owned by `services/reminders` (Stage 4).

### Surprise loot after workouts (planned)

- A low-probability drop at the end of a session: rare badges, earned streak freezes (capped at 2), an on-screen animation. Nothing paid, nothing that unlocks a workout feature the user could not otherwise reach.
- Drop odds published in the catalogue so the "rare" badge is actually rare.

## 5. Machine recognition

Users who train at a gym point the camera at a machine's label; the app matches the label against the catalogue and pre-fills the exercise.

### OCR-first (planned)

- On-device OCR (Tesseract WASM, or a smaller WebNN model if one lands) reads the label. No photos leave the device. Only the matched text is persisted.
- The match against `services/catalogue` is a fuzzy lookup against a per-brand index. A confirmed match remembers the per-user machine so future visits to the same bench are one-tap.

### Community fallback (planned)

- When OCR misses, the user can confirm a machine from the top-three guesses. The confirmation is written back to `services/catalogue` as a contribution. One confirmed match helps every subsequent user.

### QR codes optional (planned)

- Gyms that print QR codes on their machines can serve the raw catalogue id. The app takes the QR path first if it is available but never requires it.

### Per-machine settings memory (planned)

- Cable heights, pin positions, seat heights live in the user's profile once they confirm a value. The next visit suggests a small progression (for example, "last week 60 kg for 8, try 62.5 kg today") following the progressive-overload rule planned in `services/planner`.

## 6. Friends and leaderboards

The session agreed on two design rules:

- **Rank by effort against the user's own plan, not by raw strength.** The leaderboard column is "plan completion percentage" rather than "total weight lifted".
- **Separate boards per track.** A push-up leaderboard and a squat leaderboard, not a global one. Team quests pool reps inside a track.

Additional rules:

- Verified data only. Camera-counted reps and logged resistance sessions (which are trusted) count; anything self-estimated in minutes does not.
- Opt-in, private by default. A friend request shares totals and streaks only; it never shares body weight, location, time zone, or camera data.
- Owned by `services/social` (new, planned). Starts as a weekly pull on an EventBridge schedule so there is no real-time infrastructure to pay for.

## 7. Open questions

Three items the session deliberately left for the owner.

### Coach split: user-built, app-suggested, or both?

- The roadmap currently assumes both, because the project spec is clear that the user should be able to override anything. Owner decision: ship the first version with "both", or with "app-suggested" only (simpler, less surface area). Picking one trims Stage 4 scope.

### Assessment length and confidence-weighting formula

- 3 to 5 assessment sessions is a range, not a decision. Owner picks: fixed 3, fixed 5, or user-chosen in [3, 5] with the confidence weight scaled by the count.
- The exact confidence-weight function (variance-based, count-based, or both) stays open.

### Hosting alternative if the app goes commercial

- Vercel Hobby is free but non-commercial. Candidates: Cloudflare Pages for the static bundle (free tier is generous and commercial-safe), AWS Amplify Hosting (free tier for a year), or a Workers-only setup that serves the SPA from R2 via a Worker.
- No decision is needed until the owner opens monetisation. Flagging so the switch is not surprising.

## What this session delivered

Three independent PRs merged over this session, in strict order:

- **PR #29 (merged, 2026-11-13).** `bongani/auth-public-app-url`. Tightened the `APP_PUBLIC_URL` validator to reject trailing slashes and documented the setting in the auth READMEs and `.env.example`. See [`infra/auth/lib/AppPublicUrl.ts`](../../infra/auth/lib/AppPublicUrl.ts) and the 2026-11-13 entry in [`docs/overnight-report.md`](../overnight-report.md).
- **PR #30 (in flight).** `bongani/pushup-strict-overlay`. Strict push-up detection as five composable strategy classes, skeleton overlay in [`packages/pose/src/browser`](../../packages/pose/src/browser), posture-aware UI. See [`packages/exercise-pushup`](../../packages/exercise-pushup) and the Part 2 entry in [`docs/overnight-report.md`](../overnight-report.md).
- **PR #31 (in flight, this document).** `bongani/design-session-docs`. This file plus README and roadmap link updates.

## Already built, cross-session (for context)

- [`services/auth`](../../services/auth) - own-identity on AWS Lambda + DynamoDB.
- [`services/catalogue`](../../services/catalogue) - read-only exercise data on Cloudflare Worker + D1.
- [`services/logging`](../../services/logging) - workout log on AWS Lambda + DynamoDB, emits `workout.logged.v1`.
- [`services/media`](../../services/media) - exercise GIFs on Cloudflare R2.
- [`services/progress`](../../services/progress) - XP, levels, streaks, daily target.
- [`services/achievements`](../../services/achievements) - badges on Cloudflare Worker + D1.
- [`apps/web`](../../apps/web) - React PWA shell on Vercel.
- [`apps/pushup-counter`](../../apps/pushup-counter) - MediaPipe rep counter widget.
