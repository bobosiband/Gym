# services/planner

Rule-based daily workout plans using goals, recent training, and recovery. **No model generates plans.**

- **Status.** Scaffold only. Implementation lands in Stage 4.
- **Proposed language.** Python (pending owner approval).
- **Infra.** AWS Lambda.
- **Data store.** AWS DynamoDB.
- **Events in.** `workout.logged`.
- **Events out.** None.

See `docs/architecture.md` for context.
