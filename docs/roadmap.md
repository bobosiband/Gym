# Gym roadmap

Living record of planned features. Each row names the owning service (existing or new), the events it consumes or emits, and any open questions. Nothing in this file is code or infrastructure; it is a shared backlog so cross-service work can be sequenced sensibly.

Items are grouped by status:

- **Built** means a merged PR covers at least a slice of the feature.
- **In flight** means a PR is open against `main`.
- **Planned** means nothing has been written yet; implementation waits for owner approval.

The order within each group is not a schedule.

## Guiding constraints that still apply

- Zero recurring cost. Any new feature that would need a paid tier or a persistent dedicated instance stops for owner review.
- Camera video never leaves the device. On-device inference only.
- The AI coach is retrieval-grounded; invented form cues are the worst output. See `docs/architecture.md`.
- Services never read another service's database directly. Communicate via versioned events or HTTP APIs in `packages/contracts`.

## Built or in flight (tonight)

### Daily push-up target

- **Status.** In flight on `bongani/progress`.
- **Owning service.** `services/progress`.
- **What it does.** User picks a target (reps per day, duration in days). Each `workout.logged.v1` with `kind: 'pushup'` counts down the remaining total. `GET /progress` returns `dailyTarget` with `remainingReps` and `completedDays`.
- **Consumes.** `workout.logged.v1`.
- **Emits.** `progress.level_up.v1` (indirectly, via the XP bonus for hitting the target).
- **Open questions.** None for Stage 3. Later stages may add partial-credit (target met on 90% of days).

### Duolingo-style streaks with earned freezes

- **Status.** Partially built. The streak state machine and the automatic-freeze path land in `bongani/progress`. Earning freezes from quests is **planned** (see "Story quests" below).
- **Owning service.** `services/progress`.
- **What it does.** Hitting the daily target or completing any resistance set extends the streak. Missing a day consumes a freeze (cap 2) or resets the streak to one.
- **Consumes.** `workout.logged.v1`.
- **Emits.** `streak.broken.v1`, `streak.frozen.v1`.
- **Open questions.** None for Stage 3.

## Planned

### Reminders that get cheekier near local midnight

- **Owning service.** `services/reminders` (Stage 4).
- **What it does.** Web Push notifications. Only fires when nothing has been logged today or the streak is at risk; copy escalates in tone from "friendly" to "urgent" as the user's local midnight approaches.
- **Consumes.** `workout.logged.v1` (to know what has been logged today), `streak.broken.v1`, `streak.frozen.v1`.
- **Emits.** None.
- **Open questions.**
  - Where does the local midnight come from? Pull the user's time zone from `services/progress` via its public API, or require the client to pass the next-local-midnight timestamp with its push subscription.
  - Pre-written copy, or a tiny on-device WebLLM shaping? Owner's call; keep the fallback copy strict so an inference failure never produces an invented fact.

### Story quests with time-limited bosses

- **Owning service.** `services/quests` (new, no stage assigned yet).
- **What it does.** A library of story quests like "The Iron Climb" where every 20 push-ups climbs a floor and unlocks the next chapter. Progress slips back after missed days. Time-limited boss challenges (e.g. "50 push-ups in a day") run in parallel to the daily target and reuse the same reps for both counters.
- **Consumes.** `workout.logged.v1`, `streak.broken.v1`.
- **Emits.** `quest.step.v1`, `quest.completed.v1`, `freeze.granted.v1`. The last of those triggers `ProgressService.grantFreezes` via a direct SDK call or an internal event (final shape to be decided with the owner).
- **Open questions.**
  - Quest content format. Keep it as JSON in the catalogue, or a dedicated repo?
  - How many quests can run concurrently? Starting cap of 3 feels tractable.

### Gym coach: weekly training split

- **Owning service.** `services/planner` (Stage 4).
- **What it does.** A rule-based weekly split (today's leg day, today's push day) that pulls the day's exercises from the catalogue. Each set is logged as it is finished and feeds the streak via `services/logging`. Finishing a planned session counts toward the streak.
- **Consumes.** `workout.logged.v1` (to know what has been completed today), `exercise` reads from `services/catalogue` via HTTP.
- **Emits.** `plan.generated.v1`, `plan.completed.v1`.
- **Open questions.**
  - User-built split, app-suggested split, or both? The project spec's push for retrieval-grounded guidance suggests "both": the user picks a template (upper/lower, PPL, full-body) and the planner fills in exercises from the catalogue.
  - How many sets per exercise? Default 3 with user override, bounded by the catalogue's exercise metadata.

### On-device AI coach (WebLLM)

- **Status.** Planned for Stage 5.
- **Owning service.** `apps/coach`.
- **What it does.** A small open model (Llama 3.2 1B, Qwen, or Gemma) run entirely in-browser via WebLLM. Tone and encouragement only; every fact comes from `services/catalogue` and `services/planner` through retrieval.
- **Consumes.** None (reads catalogue and planner over HTTP).
- **Emits.** None.
- **Open questions.** Browser compatibility matrix (WebGPU required; the fallback is the shell without a coach).

### Private calendar subscription (`.ics`)

- **Owning service.** `services/calendar` (new; Stage 4 or later, pencil only).
- **What it does.** A per-user `.ics` subscription URL built from the user's split and push-up schedule, consumed by Apple Calendar, Google Calendar, and Outlook. Mirrors the UNSW timetable pattern. Each URL carries a secret token the user can reset.
- **Consumes.** HTTP reads from `services/planner` (planned sessions) and `services/progress` (daily target).
- **Emits.** None.
- **Open questions.**
  - Hosting shape. A Cloudflare Worker that renders the `.ics` on each request keeps the free-tier footprint small; token rotation is cheap.
  - Refresh cadence varies per calendar app (Apple refreshes hourly, Google daily, Outlook roughly hourly). Document the typical lag rather than trying to work around it.

### Progress tracking charts and personal bests

- **Owning service.** `services/stats` (Stage 4).
- **What it does.** Charts of push-ups and lifts over time. Fires a personal-best notification when a new per-exercise reps or weight record is set.
- **Consumes.** `workout.logged.v1`.
- **Emits.** `personal_best.set.v1`.
- **Open questions.** Rendering happens entirely on the client; stats only ships normalised series data.

### Rest timer

- **Owning service.** `apps/web`.
- **What it does.** Starts automatically when a set is logged. Configurable per-user default; per-exercise override lives in the catalogue payload (`restSeconds`).
- **Consumes.** The logging API's response (local behaviour).
- **Emits.** None (purely client-side).
- **Open questions.** None.

### Progressive overload hints

- **Owning service.** `services/planner` (Stage 4).
- **What it does.** For resistance exercises, suggest the next-session load based on the last session's reps and weight (for example, "last week 60 kg for 8, try 62.5 kg today"). Rule-based, no model.
- **Consumes.** `workout.logged.v1`.
- **Emits.** None (surfaces through the planner API).
- **Open questions.** Which rule? Starting with Prilepin-like increments feels safe; owner approves per-exercise defaults from the catalogue.

### Friends and leaderboards

- **Owning service.** `services/social` (new; no stage assigned yet).
- **What it does.** Weekly push-up leaderboards and team quests.
- **Consumes.** `workout.logged.v1`, `progress.level_up.v1`.
- **Emits.** `team.joined.v1`, `team.completed_quest.v1`.
- **Open questions.**
  - Zero-cost rule: this feature pushes against the free tier if it needs real-time delivery. Starting with a weekly pull on an EventBridge Scheduler + Lambda roll-up keeps it free.
  - Privacy: default to opt-in for friend lists; never surface a user's time zone to friends.

### Camera form check

- **Owning service.** `apps/web` (reuses `apps/pushup-counter` plumbing).
- **What it does.** Camera-based form feedback via MediaPipe Pose. No video leaves the device. Produces structured hints like "elbows too wide" from catalogue-provided form cues.
- **Consumes.** `services/catalogue` for per-exercise form cues.
- **Emits.** None.
- **Open questions.** Catalogue schema already carries `instructions`; a `formCues` field would be a breaking schema change. Owner decision needed before adding.

## Items worth watching for the zero-cost rule

- **AI coach model distribution.** WebLLM models can top 1 GB. Serving them from a free CDN (jsDelivr, Hugging Face Hub) stays free; a self-hosted bucket does not.
- **Push notifications at scale.** Free Web Push works for VAPID-signed messages; AWS SNS for Web Push has a 1 million/mo free tier that is easy to blow past at tens of thousands of users.
- **Calendar subscriptions.** A Worker-rendered `.ics` is cheap, but if the renderer ever starts fetching every planned session from DynamoDB on every poll, that bill shifts to the planner service's Lambda count. Materialise a cached `.ics` body in R2 when the plan changes.
- **Friends and leaderboards.** Real-time delivery is tempting but blows the budget. Keep it to weekly roll-ups on an EventBridge schedule.
