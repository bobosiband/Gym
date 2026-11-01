# infra/media

IaC for `services/media`.

- **Status.** Stage 2, infra defined. Not deployed.
- **Tool choice.** Wrangler.
- **Account.** Cloudflare free tier.

## Where the Wrangler config lives

Cloudflare Worker services keep their `wrangler.toml` next to the
source so a single `pnpm --filter @gym/media dev` call picks it up
without extra flags. For `services/media` that file is at
`services/media/wrangler.toml`; this folder stays as a notes-only
companion matching the layout of `infra/catalogue`.

## Prerequisites

The R2 bucket is created once, out of band, with:

```
wrangler r2 bucket create gym-media
```

The bucket is free up to 10 GB of storage and 1,000,000 class-A
operations per month, well inside the Cloudflare free tier for an
exercise GIF library.

## Deploy (owner only, not run tonight)

```
pnpm --filter @gym/media typecheck
pnpm --filter @gym/media test
wrangler deploy
```

Deploys are deliberately not scripted into the service's
`package.json` scripts tonight: the overnight run must not create or
change any cloud resource.

## Observability

`[observability]` is set to `enabled = true` in `wrangler.toml` so
every production invocation shows up in the Cloudflare dashboard.
Free tier is sufficient for the exercise-library traffic volume.
