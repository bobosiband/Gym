import type { AuthApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { AuthService } from '../service/AuthService.js';
import { AuthServiceError } from '../service/AuthServiceErrors.js';
import { HandlerBase } from './HandlerBase.js';
import { HandlerSchemas } from './HandlerSchemas.js';

/**
 * Handles `POST /auth/login`.
 *
 * On success returns `LoginResponse` with an access and refresh
 * token. On any failure returns a generic UNAUTHORIZED body so the
 * endpoint cannot be used to distinguish "no such user" from "wrong
 * password", with FORBIDDEN as the sole exception for unverified
 * accounts (which already know their email on file).
 */
export class LoginHandler {
  public constructor(private readonly service: AuthService) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('auth.login', event);
    const parsed = HandlerBase.parseBodyOrFail(event, HandlerSchemas.login());
    if (!parsed.ok) return parsed.response;

    const { email, password } = parsed.value as AuthApi.LoginRequest;

    try {
      const tokens = await this.service.login(email, password);
      logger.info('login ok');
      const body: AuthApi.LoginResponse = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresInSeconds: tokens.expiresInSeconds,
      };
      return ApiResponder.respond(200, body);
    } catch (err) {
      if (err instanceof AuthServiceError) {
        logger.warn('login failed', { code: err.code });
        return HandlerBase.mapAuthError(err);
      }
      logger.error('login failed with unexpected error');
      return ApiErrors.internal();
    }
  }
}
