# infra/

Infrastructure as code, one folder per service. The IaC tool is chosen per service when the service is actually built, and must be free to run.

- AWS services (`auth`, `logging`, `stats`, `planner`, `reminders`): candidates are AWS CDK (TypeScript) or SST. Owner approves the choice at the start of Stage 2 (for logging/auth) and Stage 4 (for stats, planner, reminders).
- Cloudflare services (`catalogue`, `media`, `progress`, `achievements`): Wrangler.

## Rules

- No infra code may be applied against a real cloud account without the owner's explicit approval and billing alerts configured on that account first.
- Secrets live in environment variables, never committed. The `.env.example` convention (if used) must only contain placeholder values.
- Every service's IaC is reviewed before `terraform apply` or equivalent runs.
