# tests/e2e

End-to-end flows across services. Target flows (not implemented yet):

- Log a set via `apps/web` and see XP, achievements, and reminders react correctly.
- Count 10 push-ups in-browser (synthetic pose), hit `services/logging`, verify `workout.logged` arrives at `services/stats` and `services/progress`.

Runs against local emulators (DynamoDB Local, Wrangler dev) only. No cloud credentials in CI.
