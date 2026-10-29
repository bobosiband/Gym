import type { AuthApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { AuthService } from '../service/AuthService.js';
import type { JwtSigner } from '../tokens/JwtSigner.js';
import { HandlerBase } from './HandlerBase.js';

/**
 * Handles `GET /auth/me`.
 *
 * Verifies the Authorization bearer JWT inline using the service's
 * own `JwtSigner`. We do this inside the Lambda (rather than a
 * dedicated API Gateway JWT authorizer) because API Gateway v2's
 * built-in JWT authorizer requires the issuer to publish an OIDC
 * discovery document at `/.well-known/openid-configuration`, which
 * would force a two-phase deploy; the security guarantee is the
 * same once the request body never gets to look at a user record
 * without a valid signature. Other services will plug a JWT
 * verifier middleware into their own request path the same way.
 *
 * Still rejects requests before any Dynamo read: a missing or
 * malformed header, a bad signature, a wrong issuer or audience,
 * or an expired token all return 401 with the generic body.
 */
export class MeHandler {
  public constructor(
    private readonly service: AuthService,
    private readonly signer: JwtSigner,
    private readonly issuer: string,
    private readonly audience: string
  ) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('auth.me', event);
    const bearer = MeHandler.readBearerToken(event);
    if (bearer === null) {
      logger.warn('me called without bearer token');
      return ApiErrors.unauthorized('invalid credentials');
    }
    let subject: string;
    try {
      const claims = await this.signer.verify(bearer, this.issuer, this.audience);
      subject = claims.sub;
    } catch {
      logger.warn('me token verify failed');
      return ApiErrors.unauthorized('invalid credentials');
    }
    const user = await this.service.getProfile(subject);
    if (user === null) {
      logger.warn('me subject not found');
      return ApiErrors.unauthorized('invalid credentials');
    }
    const body: AuthApi.MeResponse = {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    };
    return ApiResponder.respond(200, body);
  }

  private static readBearerToken(event: APIGatewayProxyEventV2): string | null {
    const headers = event.headers ?? {};
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'authorization') {
        const value = headers[key];
        if (typeof value !== 'string') return null;
        const match = value.match(/^Bearer\s+(.+)$/i);
        return match === null ? null : (match[1] ?? null);
      }
    }
    return null;
  }
}
