import type { AuthApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { AuthService } from '../service/AuthService.js';
import { AuthServiceError } from '../service/AuthServiceErrors.js';
import { HandlerBase } from './HandlerBase.js';
import { HandlerSchemas } from './HandlerSchemas.js';

/**
 * Handles `POST /auth/refresh`. Rotates the refresh token on every
 * successful call. If the presented refresh token has already been
 * used, the whole family is revoked and the response is UNAUTHORIZED.
 */
export class RefreshHandler {
  public constructor(private readonly service: AuthService) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('auth.refresh', event);
    const parsed = HandlerBase.parseBodyOrFail(event, HandlerSchemas.refresh());
    if (!parsed.ok) return parsed.response;

    const { refreshToken } = parsed.value as AuthApi.RefreshRequest;

    try {
      const tokens = await this.service.refresh(refreshToken);
      logger.info('refresh ok');
      const body: AuthApi.RefreshResponse = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresInSeconds: tokens.expiresInSeconds,
      };
      return ApiResponder.respond(200, body);
    } catch (err) {
      if (err instanceof AuthServiceError) {
        logger.warn('refresh failed', { code: err.code });
        return ApiErrors.unauthorized('invalid credentials');
      }
      logger.error('refresh failed with unexpected error');
      return ApiErrors.internal();
    }
  }
}
