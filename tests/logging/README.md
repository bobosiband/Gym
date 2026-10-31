# tests/logging

Vitest suite for `services/logging`. Every boundary is behind an
interface, so these tests use in-memory doubles in `./support`
and never reach AWS. The only test that opens a real socket is
`JwksJwtVerifier.test.ts`, which spins up a loopback HTTP server
to serve a JWKS document to the verifier under test.

## Support doubles

- `buildLoggingService.ts`: factory that wires every double into
  a `LoggingService` and returns a `TestHarness`.
- `InMemoryWorkoutRepository.ts`: matches the Dynamo semantics
  (duplicate rejection, newest-first listing, cursor pagination).
- `InMemoryIdempotencyRepository.ts`: conditional-create keyed by
  `(userId, idempotencyKey)`.
- `RecordingEventPublisher.ts`: records every published event
  and can be programmed to fail once or always.
- `FakeClock.ts`: deterministic time starting at
  `2026-01-01T00:00:00.000Z`; tests call `advanceSeconds`.
- `CountingIdGenerator.ts`: emits predictable UUID-v4-shaped
  strings so assertions are stable.
- `FakeJwtVerifier.ts`: returns the token string itself as the
  subject; `failNext` short-circuits for negative tests.
- `events.ts`: minimal `APIGatewayProxyEventV2` builder.

## Cases

### LoggingService.test.ts

- Persists a workout and publishes `workout.logged.v1`.
- Returns the same workout on an idempotent retry (no duplicate
  row, no duplicate event).
- Resumes an in-progress idempotency row by re-publishing with
  the stored `eventId` and marks the row completed.
- Surfaces `EVENT_PUBLISH_FAILED` when retries keep failing.
- Without an idempotency key, a publish failure surfaces as a
  service error after the row has been persisted.
- `getWorkout` returns the caller's own row, 404s on foreign or
  missing rows.
- `listWorkouts` returns the caller's rows newest first,
  paginates with a cursor, and scopes to the caller only.

### LogWorkoutHandler.test.ts

- `201` and the workout for a valid request.
- `401` when the Authorization header is missing or rejected by
  the verifier.
- `400` for an invalid body, `413` for an oversize body, `400`
  for a malformed `Idempotency-Key` header.
- Returns the cached response (byte-equal) on an idempotent retry
  without duplicating.
- `503` when publishing persistently fails.

### GetWorkoutHandler.test.ts

- `200` with the workout for its owner.
- `404` on a foreign or unknown id.
- `401` without a token.

### ListWorkoutsHandler.test.ts

- Newest-first ordering.
- Cursor-based pagination.
- `400` for an out-of-range limit.
- `401` without a token.

### HealthHandler.test.ts

- `200` with an HTML page.
- Dependency-free: works with an empty `process.env`.
- Escapes the embedded server timestamp.

### BodyParser.test.ts

- Valid, invalid, strict (unknown field), oversize, base64,
  missing, and malformed JSON cases.

### Cors.test.ts

- Wildcard mode emits `access-control-allow-origin: *` without
  `vary`.
- Named mode echoes an exact-match Origin with `vary: Origin`.
- Non-matching origins get no CORS headers.
- `parseAllowedOrigins` handles wildcard and trimmed lists.

### HandlerSchemas.test.ts

- `logWorkout` accepts pushup and set payloads, rejects unknown
  fields (strict), negative reps, non-integer reps, and unknown
  kinds.
- `listWorkoutsQuery` coerces `limit`, rejects out-of-range
  limits, and rejects non-ISO timestamps.

### JwksJwtVerifier.test.ts

Starts a loopback HTTP server to serve a JWKS document, mints an
ES256 token with `jose`, and asserts:

- A correct token verifies and returns the subject.
- Wrong audience, wrong issuer, and malformed tokens all throw.

### EventPayload.test.ts

- The published payload matches
  `WorkoutLoggedV1Event.workoutLoggedV1Schema`.
- Optional `weightKg` and `durationSeconds` are included when
  supplied and omitted when not.

### OpenApiSpec.test.ts

- Byte-equal check: `docs/swagger/logging.yaml` matches the
  output of `generateOpenApiYaml()` (no drift from the Zod
  contracts).
- Validates the committed yaml against the OpenAPI 3.1 standard
  via `@readme/openapi-parser`.
- Asserts every `servers[].url` is `https://` and never points at
  `localhost` or `127.0.0.1`.
