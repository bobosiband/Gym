import type { JwtSigner } from '../../../services/auth/src/tokens/JwtSigner.js';
import type { AccessTokenClaims } from '../../../services/auth/src/tokens/TokenPayloads.js';

/**
 * In-memory `JwtSigner` for `AuthService` tests. Produces a stable,
 * easily asserted string (`access#sub#iat#exp`) rather than a real
 * signed JWT; the ES256 contract is covered separately by the
 * `JoseJwtSigner.test.ts` suite, which exercises the real `jose`
 * library.
 */
export class FakeJwtSigner implements JwtSigner {
  public async sign(claims: AccessTokenClaims): Promise<string> {
    return `access#${claims.sub}#${claims.iat}#${claims.exp}`;
  }

  public async verify(
    token: string,
    _expectedIssuer: string,
    _expectedAudience: string
  ): Promise<AccessTokenClaims> {
    const parts = token.split('#');
    if (parts.length !== 4 || parts[0] !== 'access') {
      throw new Error('invalid test token');
    }
    const sub = parts[1] ?? '';
    const iat = Number.parseInt(parts[2] ?? '0', 10);
    const exp = Number.parseInt(parts[3] ?? '0', 10);
    return { sub, iss: 'test-issuer', aud: 'test-audience', iat, exp };
  }
}
