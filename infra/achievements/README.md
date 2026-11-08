# infra/achievements

Infrastructure for `services/achievements`. Everything required to run the service lives next to the code so a single `pnpm --filter @gym/achievements deploy` is the only command the owner runs:

- **Worker config.** `services/achievements/wrangler.toml`.
- **Database.** Cloudflare D1 (`gym-achievements`). Created once with `wrangler d1 create gym-achievements`; the returned `database_id` is pasted into `wrangler.toml`.
- **Migrations.** `services/achievements/migrations/` runs via `wrangler d1 migrations apply`.
- **Secrets.** `INTERNAL_EVENTS_KEY` (shared secret for the internal webhook) is set with `wrangler secret put INTERNAL_EVENTS_KEY`. Public vars (`JWT_ISSUER`, `JWT_AUDIENCE`, `JWKS_URL`, `ALLOWED_ORIGINS`) live in `wrangler.toml`.
- **EventBridge bridge.** Not provisioned yet. Once a subscriber appears the plan is an API Destination on `gym-events` targeting `POST /events` with the key in `X-Internal-Events-Key`; cost stays inside the free tier up to roughly a million events per month.

See `services/achievements/README.md#deploy-checklist` for the end-to-end deploy flow.
