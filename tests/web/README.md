# tests/web

Vitest suite for `apps/web`, run under jsdom. No real network: tests pass stub `fetch` implementations and in-memory `localStorage` fakes.

## Covered

- `support/`: in-memory storage, scripted fetch, deterministic clock.
- `TokenStore.test.ts`: save/read/clear round-trip, expiry window, malformed storage recovery.
- `FetchHttpClient.test.ts`: JSON encoding, bearer injection, header merging, non-2xx mapping to `HttpError`.
- `SessionManager.test.ts`: refresh memoisation, logout notification, refresh failure clears tokens.
- `AuthorizedRequest.test.ts`: single retry on 401, no retry on other errors.
- `AuthApiClient.test.ts`: endpoint URLs, request bodies, response mapping.
- `LoggingApiClient.test.ts`: idempotency-key header forwarding, cursor query encoding.
- `RouteResolver.test.ts`: path and query parsing for every registered route.
- `IdempotencyKey.test.ts`: delegates to the injected `randomUUID`.

Run from the repo root:

```
pnpm --filter @gym/web test
```
