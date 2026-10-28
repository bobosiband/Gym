# services/catalogue

Exercise names, muscle groups, equipment, instructions, and per-entry attribution. Served read-only from a Cloudflare D1 database via a Cloudflare Worker.

- **Status.** Stage 2, deployable. Schema, Worker handlers, CORS, health probe, caching, observability, local D1 integration tests, and a smoke-test script are all in place. No cloud account has been provisioned by me; deployment is manual per the runbook at `infra/catalogue/README.md`.
- **Language.** TypeScript.
- **Infra.** Cloudflare Worker + Cloudflare D1.
- **Events in.** None.
- **Events out.** None.
- **Auth.** None. The API is intentionally public and read-only until `services/auth` lands and the owner adds a JWT verifier here. See **TODO: auth** below.

## API

All responses are JSON. Error bodies follow the `ApiError` shape in `@gym/contracts/api/catalogue`. Successful exercise responses carry `cache-control: public, max-age=300`.

### GET /health

Returns `{ "status": "ok" }`. Does not touch D1 so platform health checks keep working if the database is unavailable.

- 200: `HealthResponse` ({ status: 'ok' }).

### GET /exercises

List exercises, ordered by name ascending. Optional filters.

- `muscle` (string): return only exercises whose `muscles` array contains this value.
- `equipment` (string): return only exercises whose `equipment` array contains this value.
- `limit` (integer, default 50, max 100): page size.
- `offset` (integer, default 0): page offset.

**200 response:** `ExerciseListResponse` with `exercises: Exercise[]` and `total: number`. `cache-control: public, max-age=300`.

**400 response:** `ApiError` with `code: 'BAD_REQUEST'` when a parameter is malformed.

### GET /exercises/:slug

Fetch one exercise by its lowercase kebab-case slug.

**200 response:** `ExerciseDetailResponse` with `exercise: Exercise`. `cache-control: public, max-age=300`.

**400 response:** `ApiError` with `code: 'BAD_REQUEST'` when `:slug` is not kebab-case.

**404 response:** `ApiError` with `code: 'NOT_FOUND'` when no row matches.

### OPTIONS *

CORS preflight. If the request's `Origin` is listed in the `ALLOWED_ORIGINS` env var, responds `204` with `access-control-allow-methods: GET, OPTIONS` and `access-control-allow-origin: <echoed>`. Otherwise responds `204` with no CORS headers so the browser blocks the follow-up.

Every non-preflight response from an allowed origin also carries `access-control-allow-origin` and `vary: Origin`.

## Data model

See `migrations/0001_initial.sql` and `migrations/0002_add_attribution.sql`. `muscles` and `equipment` are JSON-encoded string arrays in SQLite TEXT columns. Filtering uses `LIKE '%"<value>"%'`, which matches a quoted JSON string exactly. Every row includes `licence`, `author`, and `sourceUrl` so the API response can carry attribution with the data.

## Attribution

Every exercise returned carries the licence (CC-BY-SA 3.0 / 4.0, CC-BY 4.0, CC0, or ODbL), the author recorded by wger, and the source URL on wger.de. See `docs/SOURCES.md` for the full licence URLs and the owner's approval record.

## Local development

See `infra/catalogue/README.md` for the full deploy runbook. In short, once you have logged in with `wrangler` and created the D1 database:

```
pnpm --filter @gym/catalogue db:migrate:local
pnpm --filter @gym/catalogue import:wger
pnpm --filter @gym/catalogue db:seed:local
pnpm --filter @gym/catalogue dev
```

That serves on `http://localhost:8787` by default.

## Testing

```
pnpm --filter @gym/catalogue test
```

Runs 48 Vitest cases:

- 31 unit tests cover `ListParamsParser`, `SlugValidator`, `ExerciseFormatter`, and `WgerExerciseAdapter`.
- 17 integration tests run inside a Workers isolate with a real local D1 (via Miniflare), seeded from `tests/catalogue/fixtures/exercises.sql`. They cover `/health`, OPTIONS preflight (allowed and denied origins), `/exercises` listing, muscle and equipment filters, limit and offset paging, 400 for bad params, `/exercises/:slug` happy path with attribution, 404, 400, and 405 on wrong-method requests to known paths.

Integration tests do not hit any real cloud account.

The smoke-test script:

```
pnpm --filter @gym/catalogue smoke https://gym-catalogue.<account>.workers.dev
```

hits `/health`, `/exercises`, and one `/exercises/:slug` over HTTP, checks status codes, `cache-control`, and attribution fields.

## Seed data

The catalogue is seeded from the wger public API. The owner approved wger's content licences on 2026-10-29; see `docs/SOURCES.md` for the full record.

Generate the seed locally with:

```
pnpm --filter @gym/catalogue import:wger
```

That runs `scripts/importWger.ts`, which paginates `GET https://wger.de/api/v2/exerciseinfo/?language=2` politely, converts each entry with `WgerExerciseAdapter`, skips entries without an English name or without a licence (counts are printed), and writes `services/catalogue/seeds/wger.sql` as idempotent `INSERT OR REPLACE` statements.

If the generated file is under 5 MB, commit it. If it is 5 MB or larger, add it to `.gitignore` and leave only the generation command documented. Either way the owner regenerates it before each deploy that needs updated content.

## TODO: auth

The API is public right now because `services/auth` has not been built. When auth lands:

1. Add a JWT verifier middleware in `Router.route` that reads the Cognito public keys from a KV binding and validates `Authorization: Bearer <jwt>` on every non-health, non-OPTIONS request.
2. Decide which endpoints stay public. `/health` must stay public. The exercise catalogue is read-only reference data and probably should also stay public, but the owner approves the final policy at that point.
3. Add integration tests covering 401 (no token), 403 (valid token for wrong audience), and happy-path (valid token).

Nothing else in the service needs to change; the handlers already read nothing user-specific.

## Related

- Architecture: `docs/architecture.md`.
- Diagrams: `docs/uml/catalogue/`.
- Deploy runbook: `infra/catalogue/README.md`.
- Attribution and licences: `docs/SOURCES.md`.
