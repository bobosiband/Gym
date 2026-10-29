# infra/auth

AWS CDK app for `services/auth`.

- **Status.** Stage 2, implemented. Not deployed.
- **Tool.** AWS CDK v2 (TypeScript).
- **Account.** AWS free tier. Billing alerts must be configured
  before the first deploy.

## Resources

- Two DynamoDB tables (`UsersTable`, `SessionsTable`) in on-demand
  mode with GSIs for look-up by email, by refresh family, by user,
  and by email-abuse counter.
- Ten Lambda functions (ARM64, Node.js 20), one per auth endpoint
  and one for `/.well-known/jwks.json`. Each has a dedicated IAM
  role scoped to only the tables, SSM parameters, and (for register)
  the EventBridge bus it needs.
- API Gateway v2 HTTP API with default throttling (20 req/s burst 40) and tighter per-route limits (2 req/s burst 5) on register,
  login, refresh, forgot-password and resend-verification.
- API Gateway JWT authorizer on `GET /auth/me` pointed at the
  JWKS endpoint.
- EventBridge bus `gym-events` for `user.registered.v1`.
- SSM standard parameters under `/gym/auth/` for the JWT key pair,
  SMTP configuration, and public (issuer, audience, JWKS URL)
  outputs.
- CloudWatch log groups with 14 day retention per Lambda.

## Deploy

See `services/auth/README.md`.

```
pnpm --filter @gym/auth setup         # one-time (seeds SSM)
pnpm --filter @gym/auth deploy:diff   # review
pnpm --filter @gym/auth deploy        # apply
```
