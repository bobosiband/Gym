# services/stats

Charts, history, personal bests. Materialises its own DynamoDB tables from `workout.logged`; never reads logging's tables directly.

- **Status.** Scaffold only. Implementation lands in Stage 4.
- **Proposed language.** Python (pending owner approval).
- **Infra.** AWS Lambda.
- **Data store.** AWS DynamoDB (its own tables).
- **Events in.** `workout.logged`.
- **Events out.** None.

See `docs/architecture.md` for context.
