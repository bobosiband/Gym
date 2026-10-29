import type { AuthApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { AuthService } from '../service/AuthService.js';
import { AuthServiceError } from '../service/AuthServiceErrors.js';
import { HandlerBase } from './HandlerBase.js';
import { HandlerSchemas } from './HandlerSchemas.js';

/**
 * Handles `POST /auth/reset-password`. Consumes the single-use reset
 * token and sets a new password. Revokes every active session for
 * the user so a leaked old refresh token cannot survive the reset.
 */
export class ResetPasswordHandler {
  public constructor(private readonly service: AuthService) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('auth.reset-password', event);
    const parsed = HandlerBase.parseBodyOrFail(event, HandlerSchemas.resetPassword());
    if (!parsed.ok) return parsed.response;

    const { token, newPassword } = parsed.value as AuthApi.ResetPasswordRequest;

    try {
      await this.service.resetPassword(token, newPassword);
      logger.info('reset-password ok');
      const body: AuthApi.ResetPasswordResponse = { status: 'password_reset' };
      return ApiResponder.respond(200, body);
    } catch (err) {
      if (err instanceof AuthServiceError) {
        logger.warn('reset-password failed', { code: err.code });
        return HandlerBase.mapAuthError(err);
      }
      logger.error('reset-password failed with unexpected error');
      return ApiErrors.internal();
    }
  }
}
