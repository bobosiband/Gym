import { SignJWT, jwtVerify, type JWTPayload, type KeyLike } from 'jose';

import type { JwtSigner } from './JwtSigner.js';
import type { AccessTokenClaims } from './TokenPayloads.js';

/**
 * `JwtSigner` backed by the `jose` library.
 *
 * The private and public keys are passed in at construction time so
 * the enclosing cold-start code can read them once from SSM and reuse
 * the parsed objects across every request handled by the Lambda
 * instance. Tokens are ES256 (ECDSA on P-256 with SHA-256) because
 * ES256 keys and signatures are small, which keeps DynamoDB and JWT
 * payloads tiny, and the operation is cheap enough to run on the
 * smallest Lambda size.
 */
export class JoseJwtSigner implements JwtSigner {
  public constructor(
    private readonly privateKey: KeyLike,
    private readonly publicKey: KeyLike,
    private readonly keyId: string,
    private readonly issuer: string,
    private readonly audience: string
  ) {}

  public async sign(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: this.keyId, typ: 'JWT' })
      .setIssuer(claims.iss)
      .setAudience(claims.aud)
      .setSubject(claims.sub)
      .setIssuedAt(claims.iat)
      .setExpirationTime(claims.exp)
      .sign(this.privateKey);
  }

  public async verify(
    token: string,
    expectedIssuer: string,
    expectedAudience: string
  ): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.publicKey, {
      issuer: expectedIssuer,
      audience: expectedAudience,
      algorithms: ['ES256'],
    });
    return JoseJwtSigner.narrowClaims(payload);
  }

  private static narrowClaims(payload: JWTPayload): AccessTokenClaims {
    const sub = payload.sub;
    const iss = payload.iss;
    const aud = payload.aud;
    const iat = payload.iat;
    const exp = payload.exp;
    if (typeof sub !== 'string' || sub.length === 0) {
      throw new Error('invalid token: missing sub');
    }
    if (typeof iss !== 'string' || iss.length === 0) {
      throw new Error('invalid token: missing iss');
    }
    if (typeof aud !== 'string' || aud.length === 0) {
      throw new Error('invalid token: missing or multi-valued aud');
    }
    if (typeof iat !== 'number' || typeof exp !== 'number') {
      throw new Error('invalid token: missing iat or exp');
    }
    return { sub, iss, aud, iat, exp };
  }

  /**
   * Return the imported public key so the JWKS handler can export it.
   * Exposed as a method rather than as a public field so callers do
   * not accidentally hold a reference to the private key.
   */
  public getPublicKey(): KeyLike {
    return this.publicKey;
  }
}
