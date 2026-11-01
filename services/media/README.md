# services/media

Serves exercise GIFs, images and short clips from Cloudflare R2 behind a Worker. Objects are uploaded ahead of time; this service does not accept writes.

- **Status.** Stage 2, implemented. Not deployed.
- **Language.** TypeScript.
- **Infra.** Cloudflare Worker over R2.
- **Data store.** R2 bucket `gym-media` (created out of band, see `infra/media/README.md`).
- **Events in.** None.
- **Events out.** None.

## Endpoints

Every error body conforms to `MediaApi.MediaApiError` in `@gym/contracts/api/media`.

| Method | Path           | Purpose                                                          | Auth |
| ------ | -------------- | ---------------------------------------------------------------- | ---- |
| GET    | `/health`      | Liveness probe (no R2 reads)                                     | None |
| GET    | `/media/<key>` | Stream a stored object with content-type, etag and cache headers | None |
| HEAD   | `/media/<key>` | Metadata without the body                                        | None |

`<key>` is a slash-separated path inside the bucket. Keys are validated
by `MediaKey.isValid`: lower-case ASCII, digits, `.`, `_`, `-`, and
`/`, no leading/trailing slash, no `..`, up to 512 characters. The
file extension must be on the content-type allow list in
`ContentType.ts` (`gif`, `jpg`, `jpeg`, `png`, `webp`, `mp4`, `webm`).

## Caching

Media is immutable once uploaded, so successful responses carry
`cache-control: public, max-age=<MAX_AGE_SECONDS>, immutable`. The
default `MAX_AGE_SECONDS` in `wrangler.toml` is one week; the owner
can tune it per environment without touching code.

Error responses are not cached.

## CORS

- `ALLOWED_ORIGINS` is a comma-separated allow list set in `wrangler.toml`.
- `OPTIONS` preflight on `/media/<key>` returns `access-control-allow-methods: GET, HEAD, OPTIONS` and `max-age: 600` for allow-listed origins; otherwise returns a bare 204 that the browser treats as a failed preflight.
- Cross-origin `GET` and `HEAD` responses echo `access-control-allow-origin` for allow-listed origins and expose `content-length`, `content-type`, and `etag`.

## Licensing

Every image or video uploaded to R2 must be covered by a licence row
in `docs/SOURCES.md` with its licence URL and commercial-reuse status
confirmed. The attribution surface on the catalogue side
(`services/catalogue`, which carries per-exercise `licence`, `author`,
and `sourceUrl` fields) is where image credits appear in the UI.
This Worker returns bytes only; it does not read or publish
attribution strings.

## Scripts

```
pnpm --filter @gym/media test       # Vitest inside Miniflare
pnpm --filter @gym/media typecheck  # tsc --noEmit
pnpm --filter @gym/media lint       # eslint src --max-warnings 0
pnpm --filter @gym/media dev        # local Wrangler dev server
```

## Tests

Live under `tests/media/`. The Worker is exercised end-to-end inside
Miniflare via `@cloudflare/vitest-pool-workers`, so the R2 binding
behaves exactly as it does in production. No Cloudflare account is
touched during the test run.

## Decisions made overnight

1. **Keys are a lower-case kebab allow list, not a free-form path.**
   `MediaKey` rejects uppercase, spaces, dot segments, path traversal,
   and anything over 512 characters. This is enforcement-at-the-door
   so later uploads cannot smuggle a key that would let a client
   escape the `/media/` namespace.
2. **Content-type is derived from the extension against a whitelist.**
   An HTML or SVG upload cannot be served, because its extension is
   not in `ContentType.BY_EXTENSION`. The 400 response makes this an
   explicit failure mode rather than silently serving a script.
3. **One week default cache, immutable.** Exercise media is uploaded
   ahead of time and never changed in place; new content gets a new
   key. The `immutable` directive lets the browser skip revalidation.
   Overridable via the `MAX_AGE_SECONDS` env var.
4. **Range requests are not forwarded in Stage 2.** The repository
   accepts a `MediaRangeRequest` so a later stage can wire up MP4
   seeking without a refactor, but the Worker always calls `get(key)`
   without a range for now. The use case is GIFs and small images.
5. **No signed URLs.** All media is public reference content. Signed
   URLs would be the right choice if we ever serve user-generated
   media; recorded here so a future contributor does not have to
   re-litigate.
6. **Wrangler.toml does not create the bucket.** The `[[r2_buckets]]`
   stanza binds to a bucket named `gym-media` that the owner creates
   once with `wrangler r2 bucket create gym-media`. The overnight run
   must not provision cloud resources.

## Related

- Architecture: `docs/architecture.md`.
- Licensing: `docs/SOURCES.md`.
- Diagrams: `docs/uml/media/`.
- Contracts: `packages/contracts/src/api/media.ts`.
