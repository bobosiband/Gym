/**
 * Produces client-side idempotency keys for retry-safe writes.
 *
 * The logging service accepts 8 to 64 character keys matching
 * `[A-Za-z0-9_-]`. A UUID v4 (via `crypto.randomUUID`) sits inside
 * that character class and gives 122 bits of entropy, which is far
 * more than enough for the "same submit twice" case this covers.
 *
 * A single-method class rather than a loose function so screens
 * receive the generator through the dependency bundle and tests can
 * swap it for a deterministic one.
 */
export class IdempotencyKey {
  private readonly crypto: Pick<Crypto, 'randomUUID'>;

  public constructor(cryptoSource: Pick<Crypto, 'randomUUID'> = globalThis.crypto) {
    this.crypto = cryptoSource;
  }

  /** Return a fresh key. */
  public next(): string {
    return this.crypto.randomUUID();
  }
}
