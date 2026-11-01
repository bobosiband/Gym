# apps/web

React + TypeScript PWA shell. Installable to the home screen, offline-capable.

- **Status.** Stage 2, implemented. Not deployed.
- **Language.** TypeScript (React + Vite).
- **Hosting.** Vercel free tier (`vercel.json` at the app root).
- **Depends on.** `services/auth`, `services/logging`, `services/catalogue`.
  Every data-plane request is authenticated with the auth service's
  ES256 JWT (verified server-side via the JWKS endpoint).
- **Events in.** None.
- **Events out.** None (emits HTTP calls).

## Screens

Routes are resolved by `src/routing/RouteResolver.ts` and rendered by
`src/app/App.tsx`.

| Path               | Screen                                                                        | Auth required |
| ------------------ | ----------------------------------------------------------------------------- | ------------- |
| `/`                | `HomeScreen`                                                                  | Yes           |
| `/log-workout`     | `LogWorkoutScreen`                                                            | Yes           |
| `/history`         | `HistoryScreen`                                                               | Yes           |
| `/login`           | `LoginScreen`                                                                 | No            |
| `/register`        | `RegisterScreen`                                                              | No            |
| `/verify-email`    | `VerifyEmailNoticeScreen` or `VerifyEmailConfirmScreen` (if `?token=` is set) | No            |
| `/forgot-password` | `ForgotPasswordScreen`                                                        | No            |
| `/reset-password`  | `ResetPasswordScreen` (reads `?token=`)                                       | No            |
| anything else      | `NotFoundScreen`                                                              | No            |

Unauthenticated access to a protected route is bounced to `/login`;
a logged-in user who navigates to an auth route is bounced to `/`,
with the exception of `/verify-email?token=...` so a magic link from
an existing session still verifies.

## Environment

The app reads backend URLs from Vite environment variables at build time. Copy `.env.example` to `.env` and fill in. `apps/web/.env` is gitignored.

| Variable                 | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `VITE_AUTH_API_URL`      | Base URL for the auth service HTTP API              |
| `VITE_AUTH_JWKS_URL`     | JWKS endpoint for verifying auth tokens client-side |
| `VITE_JWT_ISSUER`        | Expected `iss` claim on access tokens               |
| `VITE_JWT_AUDIENCE`      | Expected `aud` claim on access tokens (`gym-api`)   |
| `VITE_CATALOGUE_API_URL` | Base URL for the catalogue Worker                   |
| `VITE_LOGGING_API_URL`   | Base URL for the logging HTTP API                   |

Only non-secret URLs and public identifiers belong here. Every variable prefixed with `VITE_` is inlined into the client bundle at build time, so private keys, SMTP credentials, and AWS access keys must never appear in this file.

## Tokens

`src/auth/TokenStore.ts` persists the access and refresh tokens to
`localStorage` under a single key so a logout clears both atomically.
`SessionManager` serialises refresh attempts: a burst of parallel 401s
triggers exactly one `/auth/refresh` call. `AuthorizedRequest.run()`
retries each API call exactly once after a refresh.

## Service worker

`src/sw/ServiceWorker.ts` is bundled by Vite and emitted as `/sw.js`.
It caches the shell (`/`, `/index.html`, `/manifest.webmanifest`, the
two icons) so the app launches offline. Cross-origin API requests are
passed straight through to the network and never cached.

## Scripts

```
pnpm --filter @gym/web dev        # Vite dev server on :5173
pnpm --filter @gym/web build      # Type-check then produce a dist/
pnpm --filter @gym/web preview    # Serve the built app
pnpm --filter @gym/web lint       # eslint src --max-warnings 0
pnpm --filter @gym/web typecheck  # tsc --noEmit
pnpm --filter @gym/web test       # Vitest under jsdom
```

## Tests

Live under `tests/web/`. Vitest with the `jsdom` environment covers
`TokenStore`, `FetchHttpClient`, `SessionManager`, `AuthorizedRequest`,
`RouteResolver`, and `AuthApiClient` smoke tests. No real network
calls: `FetchLike` is a stub.

## Decisions made overnight

1. **No React Router.** A flat `RouteResolver` plus the browser's
   History API covers the shell's eight screens. Rationale: fewer
   dependencies and no bundle cost for a feature we would use at 10%
   of its capacity.
2. **No `@testing-library/react`.** Vitest + jsdom + manual DOM
   assertions cover the needed behaviour. The container is small so
   this stays maintainable; if the test suite grows above a dozen
   files, revisit.
3. **No `vite-plugin-pwa`.** The service worker is hand-written and
   lives in `src/sw/ServiceWorker.ts`. The plugin is one more
   dependency plus a workbox runtime; the hand-written worker is 70
   lines and handles the two cases we actually care about (shell
   offline, API passthrough).
4. **Tokens live in `localStorage`.** `httpOnly` cookies would be
   stronger against XSS but are impossible for a cross-origin API on a
   different TLD, which is where Vercel and AWS land. The access
   token is short-lived (15 minutes) and refresh tokens rotate on
   every use per the auth service, which limits the blast radius.
5. **One refresh request per burst.** `SessionManager` caches the
   in-flight refresh promise and multicasts it so a burst of parallel
   401s triggers exactly one `/auth/refresh` call. Writing this out
   because the memoisation pattern is subtle and easy to break during
   future edits.
6. **Pathname routing with Vercel rewrites.** `vercel.json` rewrites
   every path that is not a built asset back to `/index.html` so a
   direct URL hit or a page refresh still boots the SPA.
7. **Push-up counter is a sibling app, embedded later.** The log-
   workout screen handles both manual sets and push-up counts. When
   `apps/pushup-counter` lands, it will mount inside `LogWorkoutScreen`
   when the user picks `kind = 'pushup'`. The route and POST path do
   not change.

## Related

- Architecture: `docs/architecture.md`.
- Diagrams: `docs/uml/web/`.
- Contracts: `packages/contracts/src/api/*.ts`.
