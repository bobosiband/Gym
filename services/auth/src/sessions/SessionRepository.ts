import type { SessionArtefactKind, SessionRecord } from './Session.js';

/**
 * Persistence boundary for session artefacts (refresh, verify, reset
 * tokens). The partition key is the hashed token id so look-ups never
 * require the raw token to exist on the server.
 */
export interface SessionRepository {
  /** Insert a new session row. Must fail if the hash already exists. */
  create(record: SessionRecord): Promise<void>;

  /** Fetch a session by its hashed-token id. */
  getByHashId(tokenHashId: string): Promise<SessionRecord | null>;

  /** Mark a session as used, writing the ISO 8601 timestamp. */
  markUsed(tokenHashId: string, usedAtIso: string): Promise<void>;

  /** Mark a session as revoked, writing the ISO 8601 timestamp. */
  markRevoked(tokenHashId: string, revokedAtIso: string): Promise<void>;

  /**
   * Mark every session in a family as revoked. Used when a reused
   * refresh token is detected, which indicates token theft.
   */
  revokeFamily(familyId: string, revokedAtIso: string): Promise<void>;

  /**
   * Mark every active session for a user as revoked. Used after a
   * password reset so a leaked old refresh token cannot survive.
   */
  revokeAllForUser(userId: string, revokedAtIso: string): Promise<void>;

  /**
   * Count how many artefacts of a given kind have been issued to the
   * given email in the window `[sinceSeconds, nowSeconds]`. Used by
   * the email rate limiter.
   */
  countRecentForEmail(
    email: string,
    kind: SessionArtefactKind,
    sinceSeconds: number
  ): Promise<number>;

  /**
   * Record that a verification or reset email was sent to this
   * address. Separate from the token row because the email abuse
   * limit is a count, not a token lookup, so a short-lived counter
   * row keeps the main table focused.
   */
  recordEmailSend(email: string, kind: SessionArtefactKind, nowSeconds: number): Promise<void>;
}
