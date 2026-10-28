# services/catalogue

Exercise names, muscle groups, equipment, instructions. Served read-only from a Cloudflare D1 database via a Cloudflare Worker.

- **Status.** Stage 2 (initial implementation). Schema, Worker handlers, and tests are in place; no cloud deploy and no seed data yet.
- **Language.** TypeScript.
- **Infra.** Cloudflare Worker + Cloudflare D1.
- **Events in.** None.
- **Events out.** None.

## API

All responses are JSON. Error bodies follow the `ApiError` shape in `@gym/contracts/api/catalogue`.

### GET /exercises

List exercises, newest first. Optional filters.

- `muscle` (string): return only exercises whose `muscles` array contains this value.
- `equipment` (string): return only exercises whose `equipment` array contains this value.
- `limit` (integer, default 50, max 100): page size.
- `offset` (integer, default 0): page offset.

**200 response:** `ExerciseListResponse` with `exercises: Exercise[]` and `total: number`.

**400 response:** `ApiError` with `code: 'BAD_REQUEST'` when a parameter is malformed.

### GET /exercises/:slug

Fetch one exercise by its lowercase kebab-case slug.

**200 response:** `ExerciseDetailResponse` with `exercise: Exercise`.

**400 response:** `ApiError` with `code: 'BAD_REQUEST'` when `:slug` is not kebab-case.

**404 response:** `ApiError` with `code: 'NOT_FOUND'` when no row matches.

## Data model

See `migrations/0001_initial.sql`. `muscles` and `equipment` are JSON-encoded string arrays in SQLite TEXT columns. Filtering uses `LIKE '%"<value>"%'`, which matches a quoted JSON string exactly.

## Local development

No local dev target yet. When the owner provisions a D1 database and configures billing alerts:

1. `wrangler d1 create gym-catalogue`
2. Paste the returned id into `wrangler.toml` (uncomment the block).
3. `wrangler d1 migrations apply gym-catalogue --local` to apply schema locally.
4. `wrangler dev` to serve on `localhost`.

## Testing

Pure parsing and validation logic has unit tests in `tests/catalogue/`:

- `pnpm --filter @gym/catalogue test` runs the Vitest suite.
- Repository and handler integration tests are deferred until Miniflare is wired up.

## Seed data

**No data is seeded.** `docs/SOURCES.md` lists candidate datasets (Free Exercise DB, ExerciseDB, wger) but every row is `TODO (owner to confirm)`. Seeding is blocked on owner approval of a licence; no exercise rows should land in the migration or be loaded at runtime until that approval is recorded in `docs/SOURCES.md`.

See `docs/architecture.md` for context and `docs/uml/catalogue/` for diagrams.
