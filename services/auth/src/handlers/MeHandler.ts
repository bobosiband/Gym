import type { AuthApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { AuthService } from '../service/AuthService.js';
import { HandlerBase } from './HandlerBase.js';

/**
 * Handles `GET /auth/me`.
 *
 * The route is behind the API Gateway JWT authorizer, so by the time
 * the handler runs we have a verified token. The authorizer makes
 * the decoded `sub` claim available on
 * `event.requestContext.authorizer.jwt.claims.sub`; we rely on that
 * rather than parsing the Authorization header ourselves to avoid
 * duplicating verification.
 */
export class MeHandler {
  public constructor(private readonly service: AuthService) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('auth.me', event);
    const sub = MeHandler.readSubject(event);
    if (sub === null) {
      logger.warn('me called without subject');
      return ApiErrors.unauthorized('missing subject');
    }
    const user = await this.service.getProfile(sub);
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

  private static readSubject(event: APIGatewayProxyEventV2): string | null {
    const context = event.requestContext as unknown as Record<string, unknown>;
    const authorizer = context['authorizer'];
    if (authorizer === undefined || authorizer === null || typeof authorizer !== 'object')
      return null;
    const jwtRecord = (authorizer as Record<string, unknown>)['jwt'];
    if (jwtRecord === undefined || jwtRecord === null || typeof jwtRecord !== 'object') return null;
    const claims = (jwtRecord as Record<string, unknown>)['claims'];
    if (claims === undefined || claims === null || typeof claims !== 'object') return null;
    const sub = (claims as Record<string, unknown>)['sub'];
    return typeof sub === 'string' && sub.length > 0 ? sub : null;
  }
}
