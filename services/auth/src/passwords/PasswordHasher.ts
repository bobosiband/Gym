/**
 * Password hashing boundary.
 *
 * The only implementation in production is `Argon2PasswordHasher`,
 * which wraps `@node-rs/argon2`. Having an interface here keeps the
 * `AuthService` unit-testable without native modules and makes it
 * obvious to reviewers that no other hashing primitive is used.
 */
export interface PasswordHasher {
  /** Return the encoded argon2id hash of `password`. */
  hash(password: string): Promise<string>;

  /**
   * Constant-time verification. Returns `true` iff `password` hashes
   * to `encodedHash`. The implementation must swallow argon2 parse
   * errors by returning `false` so a corrupted hash cannot cause a
   * 500.
   */
  verify(encodedHash: string, password: string): Promise<boolean>;
}
