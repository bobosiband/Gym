import type { AuthApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { AuthService } from '../service/AuthService.js';
import { HandlerBase } from './HandlerBase.js';
import { HandlerSchemas } from './HandlerSchemas.js';

/**
 * Handles `POST /auth/logout`. Revokes the presented refresh token
 * and returns 200. Unknown tokens still return 200 so logout cannot
 * be used to enumerate valid refresh tokens.
 */
export class LogoutHandler {
  public constructor(private readonly service: AuthService) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('auth.logout', event);
    const parsed = HandlerBase.parseBodyOrFail(event, HandlerSchemas.logout());
    if (!parsed.ok) return parsed.response;

    const { refreshToken } = parsed.value as AuthApi.LogoutRequest;

    try {
      await this.service.logout(refreshToken);
      logger.info('logout ok');
      const body: AuthApi.LogoutResponse = { status: 'logged_out' };
      return ApiResponder.respond(200, body);
    } catch {
      logger.error('logout failed with unexpected error');
      return ApiErrors.internal();
    }
  }
}
