/**
 * Session artefact kinds persisted in the sessions table.
 *
 * - `refresh`: a refresh token belonging to a login family. Rotated on
 *   every use; reuse of an already-used token triggers revocation of
 *   the whole family.
 * - `verify`: a single-use email verification token with a 24h TTL.
 * - `reset`: a single-use password reset token with a 30 minute TTL.
 */
export type SessionArtefactKind = 'refresh' | 'verify' | 'reset';

/**
 * One row in the sessions table. The partition key is `tokenHashId`,
 * a base64url SHA-256 of the raw token the user holds. Raw tokens are
 * never stored.
 *
 * - `familyId` groups refresh tokens that chain through rotations so a
 *   reused refresh token can revoke the entire family.
 * - `revokedAt` and `usedAt` mark one-shot states. Reset and verify
 *   tokens read `usedAt` for single-use enforcement; refresh tokens
 *   read `usedAt` for rotation-reuse detection.
 * - `expiresAt` is a Unix epoch second, matching Dynamo TTL semantics.
 */
export interface SessionRecord {
  readonly tokenHashId: string;
  readonly kind: SessionArtefactKind;
  readonly userId: string;
  readonly familyId?: string;
  readonly createdAt: string;
  readonly expiresAt: number;
  readonly usedAt?: string;
  readonly revokedAt?: string;
}
