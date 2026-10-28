# services/reminders

Web push notifications. Fires only when nothing has been logged today or a streak is at risk.

- **Status.** Scaffold only. Implementation lands in Stage 4.
- **Proposed language.** TypeScript (pending owner approval).
- **Infra.** AWS EventBridge Scheduler + Lambda.
- **Data store.** AWS DynamoDB (push subscription tokens).
- **Events in.** `workout.logged`.
- **Events out.** None.

See `docs/architecture.md` for context.
