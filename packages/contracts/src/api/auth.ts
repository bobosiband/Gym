/**
 * Auth API contract (v1).
 *
 * HTTP shape for `services/auth`. Any change to the types in this file
 * is a breaking change and requires owner approval. Bump the version in
 * the filename (for example `auth.v2.ts`) for a breaking schema change.
 * See `docs/events.md` for the full versioning rule.
 *
 * All request and response bodies are JSON. Error bodies follow
 * `AuthApiError` and are returned with the matching HTTP status.
 */

/**
 * `GET /health` returns a self-contained HTML page, not a JSON body.
 * The route is intended for human liveness checks and does not belong
 * in the typed JSON contract: there is no response interface for it.
 *
 * The handler lives in `services/auth/src/handlers/HealthHandler.ts`
 * and renders a dependency-free page with the current server time
 * and a lightweight CSS/JS animation. It performs no DynamoDB, SSM,
 * or SMTP reads so platform liveness checks keep working during any
 * backing-service outage.
 */

/**
 * Standard error body for all 4xx and 5xx responses from the auth API.
 *
 * `code` is a stable machine-readable identifier for the error. `message`
 * is a human-readable description that is deliberately generic for
 * authentication endpoints to avoid account enumeration.
 */
export interface AuthApiError {
  readonly code:
    | 'BAD_REQUEST'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'TOO_MANY_REQUESTS'
    | 'METHOD_NOT_ALLOWED'
    | 'PAYLOAD_TOO_LARGE'
    | 'INTERNAL';
  readonly message: string;
}

/**
 * Request body for `POST /auth/register`.
 */
export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
}

/**
 * Response body for `POST /auth/register`. Deliberately generic so the
 * same response is returned whether or not the account already exists.
 */
export interface RegisterResponse {
  readonly status: 'pending_verification';
}

/**
 * Request body for `POST /auth/verify-email`.
 */
export interface VerifyEmailRequest {
  readonly token: string;
}

/**
 * Response body for `POST /auth/verify-email`.
 */
export interface VerifyEmailResponse {
  readonly status: 'verified';
}

/**
 * Request body for `POST /auth/resend-verification`.
 */
export interface ResendVerificationRequest {
  readonly email: string;
}

/**
 * Response body for `POST /auth/resend-verification`. Deliberately generic
 * so the same response is returned whether or not the account exists.
 */
export interface ResendVerificationResponse {
  readonly status: 'pending_verification';
}

/**
 * Request body for `POST /auth/login`.
 */
export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

/**
 * Response body for `POST /auth/login` on success.
 *
 * `accessToken` is a short-lived JWT (15 minutes). `refreshToken` is a
 * long-lived rotating token (30 days). `expiresInSeconds` is the lifetime
 * of the access token.
 */
export interface LoginResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresInSeconds: number;
}

/**
 * Request body for `POST /auth/refresh`.
 */
export interface RefreshRequest {
  readonly refreshToken: string;
}

/**
 * Response body for `POST /auth/refresh`. Same shape as `LoginResponse`
 * so clients can reuse the same storage.
 */
export type RefreshResponse = LoginResponse;

/**
 * Request body for `POST /auth/logout`.
 */
export interface LogoutRequest {
  readonly refreshToken: string;
}

/**
 * Response body for `POST /auth/logout`.
 */
export interface LogoutResponse {
  readonly status: 'logged_out';
}

/**
 * Request body for `POST /auth/forgot-password`.
 */
export interface ForgotPasswordRequest {
  readonly email: string;
}

/**
 * Response body for `POST /auth/forgot-password`. Deliberately generic
 * so the same response is returned whether or not the account exists.
 */
export interface ForgotPasswordResponse {
  readonly status: 'pending_reset';
}

/**
 * Request body for `POST /auth/reset-password`.
 */
export interface ResetPasswordRequest {
  readonly token: string;
  readonly newPassword: string;
}

/**
 * Response body for `POST /auth/reset-password`.
 */
export interface ResetPasswordResponse {
  readonly status: 'password_reset';
}

/**
 * Response body for `GET /auth/me`. Returned to a caller holding a valid
 * access token for the user.
 */
export interface MeResponse {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly emailVerified: boolean;
    readonly createdAt: string;
  };
}

/**
 * A single key entry in the JWKS document, matching RFC 7517 for an
 * EC public key. Only the fields required to verify an ES256 signature
 * are populated.
 */
export interface JwkEcPublicKey {
  readonly kty: 'EC';
  readonly crv: 'P-256';
  readonly x: string;
  readonly y: string;
  readonly kid: string;
  readonly alg: 'ES256';
  readonly use: 'sig';
}

/**
 * Response body for `GET /.well-known/jwks.json`.
 */
export interface JwksResponse {
  readonly keys: readonly JwkEcPublicKey[];
}
