# tests/auth

Tests for `services/auth`. Everything in this folder runs under
Node (no AWS credentials, no SMTP). The DynamoDB, EventBridge,
Nodemailer, and clock dependencies are replaced with in-memory
fakes defined in `support/`.

## Running

```
pnpm --filter @gym/auth test
```

## Coverage

Across `AuthService.test.ts`, `PasswordHasher.test.ts`,
`JoseJwtSigner.test.ts`, `TokenHasher.test.ts`,
`BodyParser.test.ts`, `EmailRateLimiter.test.ts`,
`EmailNormaliser.test.ts`, `HandlerSchemas.test.ts`,
`Cors.test.ts`, `LoginHandler.test.ts`, `MeHandler.test.ts`,
`JwksHandler.test.ts`:

- argon2id hash + verify (correct, wrong, invalid encoding, random salt).
- Password policy length bounds (12 and 128 both ways).
- ES256 sign + verify (happy, expired, wrong issuer, wrong audience, tampered).
- Session token generation and SHA-256 hashing.
- Request body parsing: missing, invalid JSON, oversize, strict unknown fields, base64.
- Email rate limiter: three per hour per `(email, kind)`, independent by kind and email, rolls off after an hour.
- Register: new user, unverified-replay, verified-noop, publishes `user.registered.v1`, generic responses.
- Verify-email: happy, unknown token, reused, expired.
- Resend-verification: known, unknown (silent), already-verified (silent), rate-limited.
- Login: success, unknown email generic, wrong password generic, unverified 403, lockout after 5 failures, lockout expiry, dummy hash exercised on unknown email.
- Refresh: rotation, reuse revokes family, unknown token, expired.
- Logout: revokes, silent on unknown.
- Forgot/reset: success, unknown is silent, token single use, token expiry, reset revokes all sessions, weak-password rejection.
- `GET /auth/me`: happy, missing claim, unknown subject.
- JWKS: EC/P-256 key, cache-control header, cached across calls.
- CORS: parses allow list, echoes allowed origin, drops disallowed.
