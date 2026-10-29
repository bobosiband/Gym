import type { AuthApi } from '@gym/contracts';
import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { exportJWK, type KeyLike } from 'jose';

import { ApiResponder } from '../http/ApiResponder.js';

/**
 * Handles `GET /.well-known/jwks.json`.
 *
 * Exports the service's public key once per cold start and caches the
 * resulting JWKS document in a module-local variable. Responses are
 * served with a 10-minute `cache-control: public, max-age=600` so
 * other services' authorizers can cache the document and we keep well
 * inside the Lambda free tier. Rotating the key means bumping
 * `JWT_KEY_ID` in CDK and redeploying, which pushes new values into
 * SSM and invalidates the cached document on the next cold start.
 */
export class JwksHandler {
  private cachedJwks: AuthApi.JwksResponse | null = null;

  public constructor(
    private readonly publicKey: KeyLike,
    private readonly keyId: string
  ) {}

  public async handle(): Promise<APIGatewayProxyStructuredResultV2> {
    const document = await this.buildJwks();
    return ApiResponder.respond(200, document, {
      'cache-control': 'public, max-age=600',
    });
  }

  private async buildJwks(): Promise<AuthApi.JwksResponse> {
    if (this.cachedJwks !== null) return this.cachedJwks;
    const jwk = await exportJWK(this.publicKey);
    const kty = jwk.kty;
    const crv = jwk.crv;
    const x = jwk.x;
    const y = jwk.y;
    if (kty !== 'EC' || crv !== 'P-256' || typeof x !== 'string' || typeof y !== 'string') {
      throw new Error('unexpected JWK shape: service is only configured for ES256 keys');
    }
    const key: AuthApi.JwkEcPublicKey = {
      kty: 'EC',
      crv: 'P-256',
      x,
      y,
      kid: this.keyId,
      alg: 'ES256',
      use: 'sig',
    };
    this.cachedJwks = { keys: [key] };
    return this.cachedJwks;
  }
}
