# services/logging

Records sets, reps, weight, and push-up counts. Emits `workout.logged` on every successful write.

- **Status.** Scaffold only. Implementation lands in Stage 2.
- **Proposed language.** Java (pending owner approval).
- **Infra.** AWS Lambda + API Gateway.
- **Data store.** AWS DynamoDB (per-user partition key).
- **Events in.** None.
- **Events out.** `workout.logged`.

See `docs/architecture.md` and `docs/events.md` for context.
