# Gym

A free, gamified fitness web app. Day-by-day workouts, in-browser form checking for push-ups, XP and streaks for consistency, badges for progress. The AI coach runs on the user's device; camera video never leaves it.

Built as a microservice monorepo on free tiers and on-device compute. Zero recurring cost to run.

## Stack at a glance

- Frontend: React PWA on Vercel; MediaPipe Pose for the push-up counter; WebLLM for the on-device coach.
- Backend: AWS Cognito (auth), AWS Lambda + DynamoDB (logging, stats, planner, reminders), Cloudflare Workers + D1 (catalogue, progress, achievements), Cloudflare R2 (media).
- Events over AWS EventBridge; shared schemas in `packages/contracts`.

## Documentation

- Architecture: `docs/architecture.md`
- Events: `docs/events.md`
- Data and media sources: `docs/SOURCES.md`
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

Stage 1 (scaffold). No feature code yet. See the build-order sections of `docs/architecture.md` for what lands when.
