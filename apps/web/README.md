# apps/web

React + TypeScript PWA shell. Installable to the home screen, offline-capable.

- **Status.** Scaffold only. Implementation lands in Stage 2.
- **Language.** TypeScript.
- **Hosting.** Vercel free tier.
- **Depends on.** All backend services via API Gateway or Cloudflare Workers, authenticated with the auth service's ES256 JWT (verified via the JWKS endpoint).
- **Events in.** None.
- **Events out.** None (emits HTTP calls).

## Environment

The app reads backend URLs from Vite environment variables at build time. Copy `.env.example` to `.env` and fill in. `apps/web/.env` is gitignored.

| Variable                 | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `VITE_AUTH_API_URL`      | Base URL for the auth service HTTP API              |
| `VITE_AUTH_JWKS_URL`     | JWKS endpoint for verifying auth tokens client-side |
| `VITE_JWT_ISSUER`        | Expected `iss` claim on access tokens               |
| `VITE_JWT_AUDIENCE`      | Expected `aud` claim on access tokens (`gym-api`)   |
| `VITE_CATALOGUE_API_URL` | Base URL for the catalogue Worker                   |

Only non-secret URLs and public identifiers belong here. Every variable prefixed with `VITE_` is inlined into the client bundle at build time, so private keys, SMTP credentials, and AWS access keys must never appear in this file.

See `docs/architecture.md` for the full dependency map.
