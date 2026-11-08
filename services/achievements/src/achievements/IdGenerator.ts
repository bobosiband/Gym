/**
 * Port for generating a fresh id. The service uses this everywhere
 * it needs an opaque identifier (achievement.unlocked event id) so
 * tests get deterministic ids.
 */
export interface IdGenerator {
  newId(): string;
}

/** Production {@link IdGenerator} backed by `crypto.randomUUID`. */
export class CryptoIdGenerator implements IdGenerator {
  public newId(): string {
    return crypto.randomUUID();
  }
}
