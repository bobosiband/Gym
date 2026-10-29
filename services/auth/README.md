# services/auth

Sign-up, login, email verification, password reset, token issuance,
JWKS publication, and a health probe. Every other service in the
system verifies the auth JWT by pointing an API Gateway JWT
authorizer at this service's JWKS endpoint.

- **Status.** Stage 2, deployed to ap-southeast-2.
- **Language.** TypeScript.
- **Infra.** AWS Lambda behind an HTTP API Gateway, DynamoDB on
  demand, EventBridge, SSM Parameter Store (standard tier). No
  Cognito, SES, WAF, NAT gateway, VPC, provisioned concurrency, or
  KMS customer-managed keys.
- **Events in.** None.
- **Events out.** `user.registered.v1`.

## Why not Cognito

Cognito's free tier has a 50,000 monthly active user ceiling, but
every advanced feature (hosted UI customisation, email delivery,
custom domains, advanced security) rolls over into paid charges and
links to SES, which has no indefinite free tier. The project rule
is zero recurring cost, so the service owns its own identity
records. Passwords are hashed with argon2id via `@node-rs/argon2`,
and access tokens are ES256 JWTs signed with the `jose` library. We
do not implement any cryptography ourselves.

## Endpoints

Every response is JSON. Error bodies follow `AuthApi.AuthApiError`
in `@gym/contracts/api/auth` and are deliberately generic for every
authentication-sensitive route to prevent account enumeration.

| Method | Path                        | Purpose                                        | Auth   |
| ------ | --------------------------- | ---------------------------------------------- | ------ |
| GET    | `/health`                   | Liveness probe (no backing-service reads)      | None   |
| POST   | `/auth/register`            | Create account and send verification email     | None   |
| POST   | `/auth/verify-email`        | Mark the email as verified via a token         | None   |
| POST   | `/auth/resend-verification` | Re-send the verification email                 | None   |
| POST   | `/auth/login`               | Exchange credentials for access + refresh      | None   |
| POST   | `/auth/refresh`             | Rotate the refresh token, issue new access     | None   |
| POST   | `/auth/logout`              | Revoke the presented refresh token             | None   |
| POST   | `/auth/forgot-password`     | Send a password reset email                    | None   |
| POST   | `/auth/reset-password`      | Consume the reset token and set a new password | None   |
| GET    | `/auth/me`                  | Return the authenticated user's profile        | Bearer |
| GET    | `/.well-known/jwks.json`    | Export the ES256 public key for verifiers      | None   |

Access tokens live 15 minutes. Refresh tokens live 30 days and are
rotated on every successful `/auth/refresh`. Reusing an already
rotated refresh token revokes the whole session family. Verification
tokens live 24 hours; reset tokens live 30 minutes; both are single
use. All opaque tokens are stored only as SHA-256 digests.

`/auth/me` verifies the Bearer JWT inside the Lambda using the
service's own `JoseJwtSigner.verify` (issuer, audience, signature,
expiry). API Gateway v2's built-in JWT authorizer is not used
because it requires the issuer to publish an OIDC discovery
document at authorizer-creation time, which would force a two-phase
deploy for a self-hosted issuer.

`/health` is intentionally dependency-free: the Lambda has no
DynamoDB, SSM, or EventBridge grants and does not import the SSM
config loader. It returns a small self-contained HTML page with
the current UTC timestamp, a live local clock, and a pulsing
status indicator, so an operator opening the URL in a browser sees
at a glance that the API is up. Uptime checks keep working during
an SSM or DynamoDB outage because the handler reads nothing.

## Security posture

- **Rate limiting.** API Gateway stage-level throttling of 20 req/s
  with a burst of 40 on every route.
- **Email abuse limit.** No more than 3 verification or reset emails
  per address per hour, enforced from the sessions table (Dynamo
  TTL ages the counters out automatically).
- **Account lockout.** 15 minute lockout after 5 failed logins.
- **Password policy.** 12 to 128 characters. Longer passwords are
  rejected before hashing, so argon2 is never passed a hostile input.
- **Enumeration.** `/auth/register`, `/auth/login`,
  `/auth/forgot-password`, and `/auth/resend-verification` return
  identical bodies for existing and non-existing accounts.
  `/auth/login` also hashes a dummy password when the user is not
  found so the response time is similar either way.
- **Validation.** Every body is validated against a Zod schema with
  `strict()` so unknown fields are rejected, with a 4 KiB raw
  payload cap enforced before JSON parsing.
- **CORS.** Origins listed in `APP_ORIGINS` are allowed. Set
  `APP_ORIGINS=*` to allow all origins (permitted during early
  frontend bring-up per the owner's 2026-10-29 policy update);
  otherwise, comma-separate explicit origins and the request
  `Origin` is echoed only on exact match. In wildcard mode the
  response sends `access-control-allow-origin: *` without the
  `vary: Origin` header; in named-origin mode preflight is served
  per request.
- **Secrets.** Nothing hardcoded. JWT private key, SMTP credentials,
  SMTP endpoint, and the `APP_ORIGINS` list all live in SSM
  Parameter Store standard parameters. Private key and SMTP
  password are SecureString; everything else is String.
- **IAM.** Each Lambda has a dedicated role scoped to the specific
  table, parameter prefix, and (for register only) the event bus
  it needs. The health Lambda has no grants at all. No wildcard
  resources.
- **Logging.** Structured JSON lines with a request id. Tokens,
  passwords, hashes, SMTP credentials, AWS keys, and full email
  addresses are never logged. CloudWatch log retention is 14 days.

## How other services verify tokens

Every other service's CDK stack should wire a JWT verifier against
this service's JWKS endpoint and audience. The auth stack publishes
three public SSM parameters so stacks can read them without
hardcoding:

```
/gym/auth/public/issuer
/gym/auth/public/audience
/gym/auth/public/jwks-url
```

Example (Lambda-side verification, matching how `/auth/me` works):

```ts
import { importSPKI, jwtVerify } from 'jose';

const jwks = await fetch(process.env['JWKS_URL']!).then((r) => r.json());
const key = await importSPKI(/* convert first jwk to SPKI */, 'ES256');
const { payload } = await jwtVerify(token, key, {
  issuer: process.env['JWT_ISSUER'],
  audience: process.env['JWT_AUDIENCE'],
  algorithms: ['ES256'],
});
```

The subject (`sub` claim) is the user id. Services that only need
to know "who is this" should not touch the users table in this
service's database; the subject is authoritative.

## Local environment (services/auth/.env)

The repo ignores `services/auth/.env` so credentials never land in a
commit. Copy `.env.example` and fill it in.

```
AWS_ACCESS_KEY_ID=        # the deploy user's key
AWS_SECRET_ACCESS_KEY=    # the deploy user's secret
AWS_REGION=               # eg. ap-southeast-2
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=                # your Gmail address
SMTP_PASS=                # the 16-char Gmail app password
SMTP_FROM=                # your Gmail address
APP_ORIGINS=              # eg. http://localhost:5173 (comma-separated) or * for all origins
```

### Gmail app password

1. Enable 2-Step Verification on the Google account.
2. Visit <https://myaccount.google.com/apppasswords>.
3. Create an app password named `Gym auth`.
4. Paste the 16 character password into `SMTP_PASS`.
5. Set `SMTP_USER` and `SMTP_FROM` to the same Gmail address.

The password never leaves SSM once the setup script has stored it.

### IAM permissions required by the deploy user

The AWS keys in `.env` are only used from your machine. Give the
deploy IAM user these managed policies (or an equivalent inline
scope):

- `AWSCloudFormationFullAccess`
- `AmazonAPIGatewayAdministrator`
- `AWSLambda_FullAccess`
- `AmazonDynamoDBFullAccess`
- `AmazonEventBridgeFullAccess`
- `AmazonSSMFullAccess`
- `CloudWatchLogsFullAccess`
- `IAMFullAccess` (CDK creates per-Lambda roles)

Deployed Lambdas get their own narrower roles automatically.

## Setup and deploy

```
pnpm --filter @gym/auth deploy:bootstrap   # one-time, idempotent
pnpm --filter @gym/auth setup              # one-time, seeds SSM
pnpm --filter @gym/auth deploy:diff        # review the CloudFormation diff
pnpm --filter @gym/auth deploy             # apply
```

`setup` generates the ES256 key pair on first run, stores the
private key as an SSM SecureString and the public key as a String,
and copies SMTP + APP_ORIGINS into SSM. AWS keys never leave the
local filesystem.

## Tests

```
pnpm --filter @gym/auth test
```

Runs the full Vitest suite under Node. No AWS credentials are
required: DynamoDB, EventBridge, Nodemailer, clock, and id
generator are replaced with in-memory fakes in `tests/auth/support`.
See `tests/auth/README.md` for the full case list.

## Related

- Architecture: `docs/architecture.md`.
- Events: `docs/events.md` (section `user.registered.v1`).
- Diagrams: `docs/uml/auth/`.
- Contracts: `packages/contracts/src/api/auth.ts`,
  `packages/contracts/src/events/userRegistered.v1.ts`.
