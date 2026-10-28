# services/achievements

Badges and daily quests. Consumes `workout.logged` and `progress.level_up`.

- **Status.** Scaffold only. Implementation lands in Stage 3.
- **Proposed language.** TypeScript (pending owner approval).
- **Infra.** Cloudflare Worker.
- **Data store.** Cloudflare D1.
- **Events in.** `workout.logged`, `progress.level_up`.
- **Events out.** None in Stage 3 scope. `achievement.awarded` is reserved for a later stage.

See `docs/architecture.md` and `docs/events.md` for context.
