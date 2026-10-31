import { randomUUID } from 'node:crypto';

/**
 * Id-generation boundary. Kept behind an interface so tests can
 * inject a deterministic counter that produces predictable `id-1`,
 * `id-2`, ... strings for test assertions.
 */
export interface IdGenerator {
  /**
   * Generate a new identifier. Production returns a RFC 4122 v4 UUID.
   */
  newId(): string;
}

/**
 * Production `IdGenerator` backed by `node:crypto.randomUUID`.
 */
export class UuidIdGenerator implements IdGenerator {
  public newId(): string {
    return randomUUID();
  }
}
