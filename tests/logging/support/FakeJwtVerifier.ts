import type {
  AccessTokenClaims,
  JwtVerifier,
} from '../../../services/logging/src/tokens/JwtVerifier.js';

/**
 * `JwtVerifier` double. Treats the token string itself as the
 * subject so tests can mint a bearer header by passing the user
 * id. A programmed error short-circuits every verify call for
 * negative tests. No crypto, no network.
 */
export class FakeJwtVerifier implements JwtVerifier {
  private failWith: Error | null = null;

  public async verify(token: string): Promise<AccessTokenClaims> {
    if (this.failWith !== null) throw this.failWith;
    if (token.length === 0) throw new Error('empty token');
    return {
      iss: 'https://auth.gym.test',
      aud: 'gym-api',
      sub: token,
      iat: 0,
      exp: 9_999_999_999,
    };
  }

  public failNext(error: Error): void {
    this.failWith = error;
  }

  public clearFailure(): void {
    this.failWith = null;
  }
}
