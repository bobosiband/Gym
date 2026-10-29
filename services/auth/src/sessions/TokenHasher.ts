import { createHash, randomBytes } from 'node:crypto';

/**
 * Generates and hashes opaque session tokens.
 *
 * Raw tokens are URL-safe base64 strings issued to the user. The server
 * stores only the SHA-256 of each raw token (as a hex string), so a
 * dump of the sessions table cannot be replayed as valid tokens. The
 * hash is unkeyed because the raw tokens are already 32 random bytes,
 * which has enough entropy that offline guessing is infeasible.
 */
export class TokenHasher {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Produce 32 bytes of CSPRNG output encoded as url-safe base64 with
   * no padding. The resulting string is 43 characters long.
   */
  public static generateRawToken(): string {
    return TokenHasher.base64Url(randomBytes(32));
  }

  /**
   * Hash a raw token with SHA-256 and return the hex digest.
   */
  public static hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }

  private static base64Url(buf: Buffer): string {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
}
