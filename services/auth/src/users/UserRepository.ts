import type { User } from './User.js';

/**
 * Persistence boundary for the user record.
 *
 * The implementation is DynamoDB in production; tests inject an
 * in-memory fake. Methods that modify counters (`recordFailedLogin`,
 * `resetFailedLogins`) are expressed as single operations so the
 * concrete implementation can map them onto a single `UpdateItem`
 * call. `markEmailVerified` and `updatePasswordHash` are likewise
 * atomic.
 */
export interface UserRepository {
  /**
   * Insert a new user record. The implementation must atomically
   * reject the write if another record already exists for the
   * normalised email so register endpoints cannot race-create
   * duplicate accounts.
   */
  createUser(user: User): Promise<void>;

  /** Look up a user by their canonical identifier. */
  getUserById(id: string): Promise<User | null>;

  /** Look up a user by their normalised email. */
  getUserByEmail(email: string): Promise<User | null>;

  /** Mark the user's email as verified. */
  markEmailVerified(userId: string): Promise<void>;

  /**
   * Replace the user's password hash. The caller must separately
   * revoke every active session for the user.
   */
  updatePasswordHash(userId: string, newPasswordHash: string): Promise<void>;

  /**
   * Record a failed login attempt and return the resulting state.
   * If the new count has reached the lockout threshold, the caller is
   * expected to supply `lockUntilIso` so the record is locked
   * atomically with the counter increment.
   */
  recordFailedLogin(userId: string, lockUntilIso?: string): Promise<void>;

  /** Reset the failed-login counter and clear any existing lock. */
  resetFailedLogins(userId: string): Promise<void>;
}
