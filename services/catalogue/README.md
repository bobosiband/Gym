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

List exercises, ordered by name ascending. Optional filters.

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

The catalogue is seeded from the wger public API. The owner approved wger's content licences (CC-BY-SA 3.0 / 4.0, CC-BY 4.0, CC0, ODbL per entry) on 2026-10-29. See `docs/SOURCES.md` for the authoritative record.

Generate the seed locally with:

```
pnpm --filter @gym/catalogue import:wger
```

That runs `scripts/importWger.ts`, which:

1. Paginates `GET https://wger.de/api/v2/exerciseinfo/?language=2` with a polite 500 ms delay between pages (configurable via `WGER_DELAY_MS`).
2. Converts each entry with `WgerExerciseAdapter`, skipping entries without an English name or without a licence. Skip counts are printed.
3. Writes `services/catalogue/seeds/wger.sql` as `INSERT OR REPLACE` statements, which Wrangler applies with `wrangler d1 execute --file`.

If the generated `wger.sql` is 5 MB or larger, add `services/catalogue/seeds/wger.sql` to `.gitignore` and leave only the generation command documented. If it is under 5 MB, commit it.

Every row carries `licence`, `author`, and `sourceUrl` so the API response can keep attribution with the data.

See `docs/architecture.md` for context and `docs/uml/catalogue/` for diagrams.
