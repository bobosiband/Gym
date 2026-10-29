/**
 * Internal user record. The `passwordHash` field is argon2id output and
 * never leaves the service; the HTTP contract exposes only non-sensitive
 * fields via `MeResponse`.
 */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly emailVerified: boolean;
  readonly createdAt: string;
  readonly failedLoginCount: number;
  readonly lockedUntil?: string;
}
