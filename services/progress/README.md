# services/progress

XP, levels, streaks (with streak freezes). Emits `progress.level_up` when a user crosses an XP threshold.

- **Status.** Scaffold only. Implementation lands in Stage 3.
- **Proposed language.** TypeScript (pending owner approval).
- **Infra.** Cloudflare Worker.
- **Data store.** Cloudflare D1.
- **Events in.** `workout.logged`.
- **Events out.** `progress.level_up`.

See `docs/architecture.md` and `docs/events.md` for context.
