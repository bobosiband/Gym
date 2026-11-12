# Gym

A free, gamified fitness web app. Day-by-day workouts, in-browser form checking for push-ups, XP and streaks for consistency, badges for progress. The AI coach runs on the user's device; camera video never leaves it.

Built as a microservice monorepo on free tiers and on-device compute. Zero recurring cost to run.

## Stack at a glance

- Frontend: React PWA on Vercel; MediaPipe Pose for the push-up counter; WebLLM for the on-device coach.
- Backend: AWS Lambda + DynamoDB (auth, logging, stats, planner, reminders), Cloudflare Workers + D1 (catalogue, progress, achievements), Cloudflare R2 (media).
- Events over AWS EventBridge; shared schemas in `packages/contracts`.

## Documentation

- Architecture: `docs/architecture.md`
- Design sessions: `docs/design/` (latest: `docs/design/2026-11-11-design-session.md`)
- Events: `docs/events.md`
- Data and media sources: `docs/SOURCES.md`
- Roadmap: `docs/roadmap.md`
- Diagrams: `docs/uml/`

## Repository layout

```
apps/            frontend bundles (web shell, pushup-counter, coach)
services/       backend services, one per bounded context
packages/       shared code, including @gym/contracts
infra/          infrastructure-as-code, one folder per service
docs/           prose and PlantUML diagrams
tests/          test suites, mirroring the service structure
```

## Status

Stage 2 is the current working surface and Stage 3 is in flight.

**Built and deployed:**

- `services/auth` (own-identity on AWS Lambda + DynamoDB).
- `services/catalogue` (read-only exercise data on a Cloudflare Worker + D1).
- `services/logging` (workout log on AWS Lambda + DynamoDB; emits `workout.logged.v1`).

**Built, awaiting review (overnight PRs 2026-11-02):**

- `apps/web` (React PWA shell with every Stage 2 auth and logging flow; PR #10, merged).
- `apps/pushup-counter` (MediaPipe-based rep counter; standalone widget designed to embed into `apps/web`).
- `services/media` (Cloudflare Worker over R2 for exercise GIFs).
- `services/progress` (XP, levels, streaks with freezes, daily push-up target; consumes `workout.logged.v1`, emits `progress.level_up.v1`, `streak.broken.v1`, `streak.frozen.v1`).

**Planned:** see `docs/roadmap.md` for the full backlog, which services own each item, and which events each item consumes or emits.

Build-order details still live in `docs/architecture.md`.
