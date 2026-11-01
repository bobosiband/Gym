# tests/media

Vitest suite for `services/media`. Runs the Worker inside a Miniflare isolate so the R2 binding behaves exactly as it does in production without touching any Cloudflare account.

## Covered

- `MediaKey.test.ts`: key validation (whitelisted characters, path traversal, trailing slash, empty).
- `ContentType.test.ts`: extension lookup, unknown extensions, case normalisation.
- `MediaWorker.test.ts`: health probe, preflight, 404 for unknown routes, 405 for unsupported methods, successful `GET` with cache + CORS headers, `HEAD` returns metadata without a body, 404 for a missing object, 400 for a disallowed extension.

Run from the repo root:

```
pnpm --filter @gym/media test
```
