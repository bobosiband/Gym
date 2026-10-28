# services/auth

Sign-up, login, and token issuance. Every other service verifies the Cognito JWT it receives.

- **Status.** Scaffold only. Implementation lands in Stage 2.
- **Proposed language.** TypeScript (pending owner approval).
- **Infra.** AWS Cognito.
- **Data store.** Cognito user pool.
- **Events in.** None.
- **Events out.** None.

See `docs/architecture.md` for context.
