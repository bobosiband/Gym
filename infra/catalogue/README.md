# infra/catalogue: deploy runbook

Everything you need to deploy `services/catalogue` to Cloudflare Workers + D1, assuming you have never used Cloudflare before. All steps run from your machine. No CI deploys and no tokens live in the repo other than the D1 database id placeholder in `wrangler.toml`.

## Prerequisites

- Node 20 LTS installed. `nvm use` picks it up from `.nvmrc`.
- `pnpm` installed globally. `corepack enable` is the easiest way.
- A GitHub account you can use for Cloudflare SSO (optional but convenient).
- A credit card is **not** required for the free tier.
- `pnpm install --frozen-lockfile` succeeds locally.

## One-time setup

### 1. Create the Cloudflare account

1. Open https://dash.cloudflare.com/sign-up and sign up with your email. Use SSO if you prefer.
2. Verify the email.
3. From the dashboard, note the **account id** at the bottom of the right-hand sidebar on the Workers and Pages page. You will not paste it into the repo; `wrangler` picks it up from your auth session.

### 2. Configure a billing alert even on the free tier

The free tier covers everything this project uses, but accidents happen. Add an alert so a surprise is visible early.

1. In the dashboard, open **Billing** then **Notifications**.
2. Add a notification with threshold `0.01 USD` on `Workers` and `D1`. Email yourself.

### 3. Log wrangler into your account

```
pnpm --filter @gym/catalogue exec wrangler login
```

A browser tab opens asking you to authorise `wrangler`. Approve for the account you just created. No token lands in the repo; wrangler stores credentials in `~/.wrangler/`.

Verify:

```
pnpm --filter @gym/catalogue exec wrangler whoami
```

should print your account email.

## Create the D1 database

1. From the repo root, run:

   ```
   pnpm --filter @gym/catalogue exec wrangler d1 create gym-catalogue
   ```

2. Wrangler prints a block that looks like:

   ```
   [[d1_databases]]
   binding = "DB"
   database_name = "gym-catalogue"
   database_id = "<uuid printed here>"
   ```

3. Open `services/catalogue/wrangler.toml`. Find the commented `[[d1_databases]]` block near the bottom. Uncomment it and paste the real `database_id` in place of `REPLACE_WITH_ACTUAL_D1_DATABASE_ID`. Keep `database_name = "gym-catalogue"` and the `migrations_dir` line.

   The database id is a UUID and is safe to commit. No secret.

4. Commit the change on a branch and open a PR, per the usual repo workflow. Do not push directly to `main`.

## Apply schema to the real database

```
pnpm --filter @gym/catalogue db:migrate:remote
```

This runs `wrangler d1 migrations apply gym-catalogue --remote`. It applies `migrations/0001_initial.sql` and `migrations/0002_add_attribution.sql` to your remote D1. Idempotent; safe to re-run.

Verify the tables exist:

```
pnpm --filter @gym/catalogue exec wrangler d1 execute gym-catalogue --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

You should see `exercises` listed.

## Generate the wger seed

```
pnpm --filter @gym/catalogue import:wger
```

This fetches English exercises from `https://wger.de/api/v2/exerciseinfo/`, converts them with `WgerExerciseAdapter`, and writes `services/catalogue/seeds/wger.sql`.

The script is polite: 500 ms delay between pages, serial pagination, no parallel flood. Expect it to take a few minutes depending on wger's response time.

Check the output size:

```
du -h services/catalogue/seeds/wger.sql
```

- If it is **under 5 MB**: commit `services/catalogue/seeds/wger.sql` so future rebuilds and smoke tests have a reproducible seed.
- If it is **5 MB or larger**: add `services/catalogue/seeds/wger.sql` to `.gitignore` (one line) and document in the service README that each contributor regenerates it locally.

## Seed the real database

```
pnpm --filter @gym/catalogue db:seed:remote
```

This runs `wrangler d1 execute gym-catalogue --remote --file=seeds/wger.sql`. The seed uses `INSERT OR REPLACE`, so re-running it on top of an existing table is safe.

## Set the CORS allow list

Before the first deploy, edit `wrangler.toml` so `[vars] ALLOWED_ORIGINS` lists the production front-end origin. Comma-separated, no spaces required.

Example:

```
[vars]
ALLOWED_ORIGINS = "https://gym.example.com"
```

If you have a staging and a production origin, list both.

## Deploy

```
pnpm --filter @gym/catalogue deploy
```

Wrangler prints the Worker's public URL, which looks like `https://gym-catalogue.<your-subdomain>.workers.dev`.

## Smoke test

Immediately after deploy, run:

```
pnpm --filter @gym/catalogue smoke https://gym-catalogue.<your-subdomain>.workers.dev
```

The smoke test hits `/health`, `/exercises`, and one `/exercises/:slug`, asserts the status codes, the `cache-control` header, and the attribution fields. If any check fails, the exit code is non-zero.

## Observability

`wrangler.toml` enables `[observability]`, so request logs, error traces, and metrics are visible in the Cloudflare dashboard under **Workers and Pages** then your Worker then **Logs** and **Analytics**. There is no additional setup. Logs are retained per the free-tier limits.

## Rolling back

If a deploy breaks the API:

```
pnpm --filter @gym/catalogue exec wrangler deployments list
```

Pick the previous good deployment id, then:

```
pnpm --filter @gym/catalogue exec wrangler rollback <deployment-id>
```

This is a Worker-only rollback. It does not touch D1. If the broken deploy ran a migration you need to undo, write a reverse migration (`0003_revert_whatever.sql`) and run `pnpm --filter @gym/catalogue db:migrate:remote` again. There is no automated down-migration in Wrangler.

## Updating the seed

To refresh exercises from wger:

```
pnpm --filter @gym/catalogue import:wger
pnpm --filter @gym/catalogue db:seed:remote
```

The seed is idempotent, so this replaces rows in place. Deploys are not required unless the Worker code also changed.

## Checking cost

The Cloudflare dashboard shows daily request and D1 operation counts under **Workers and Pages** then **Analytics**. All of this fits inside the free tier at side-project scale; if daily counts approach 100,000 Worker requests or 100,000 D1 reads you are getting popular and should revisit the billing settings before growing further.
