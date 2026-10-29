/**
 * Internal errors thrown by `AuthService`. Each code maps to a single
 * HTTP response in the handler layer so the business logic stays
 * decoupled from HTTP concerns and remains unit-testable.
 */
export type AuthServiceErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'EMAIL_NOT_VERIFIED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_ALREADY_USED'
  | 'WEAK_PASSWORD'
  | 'EMAIL_RATE_LIMITED';

/**
 * Thrown by `AuthService` when a request cannot be fulfilled for a
 * business reason (as opposed to a programming bug). Handlers map
 * `code` to the correct HTTP status and generic response text.
 */
export class AuthServiceError extends Error {
  public constructor(public readonly code: AuthServiceErrorCode) {
    super(code);
    this.name = 'AuthServiceError';
  }
}
