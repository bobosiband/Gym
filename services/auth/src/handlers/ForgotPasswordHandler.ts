import type { AuthApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { AuthService } from '../service/AuthService.js';
import { AuthServiceError } from '../service/AuthServiceErrors.js';
import { HandlerBase } from './HandlerBase.js';
import { HandlerSchemas } from './HandlerSchemas.js';

/**
 * Handles `POST /auth/forgot-password`.
 *
 * Returns the same body for unknown and known accounts. Rate-limit
 * exhaustion still returns the generic body, matched by a 202 status
 * code, so attackers cannot probe whether an address has reached the
 * limit (we silently drop over-limit requests at the service layer by
 * raising `EMAIL_RATE_LIMITED`, which we then swallow here).
 */
export class ForgotPasswordHandler {
  public constructor(private readonly service: AuthService) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('auth.forgot-password', event);
    const parsed = HandlerBase.parseBodyOrFail(event, HandlerSchemas.forgotPassword());
    if (!parsed.ok) return parsed.response;

    const { email } = parsed.value as AuthApi.ForgotPasswordRequest;

    try {
      await this.service.forgotPassword(email);
    } catch (err) {
      if (err instanceof AuthServiceError && err.code === 'EMAIL_RATE_LIMITED') {
        logger.warn('forgot-password rate limited');
      } else {
        logger.error('forgot-password failed with unexpected error');
        return ApiErrors.internal();
      }
    }
    const body: AuthApi.ForgotPasswordResponse = { status: 'pending_reset' };
    return ApiResponder.respond(202, body);
  }
}
