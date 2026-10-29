import type { AuthApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { AuthService } from '../service/AuthService.js';
import { AuthServiceError } from '../service/AuthServiceErrors.js';
import { HandlerBase } from './HandlerBase.js';
import { HandlerSchemas } from './HandlerSchemas.js';

/**
 * Handles `POST /auth/verify-email`. Consumes a single-use token sent
 * in the verification email and marks the user as verified.
 */
export class VerifyEmailHandler {
  public constructor(private readonly service: AuthService) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('auth.verify-email', event);
    const parsed = HandlerBase.parseBodyOrFail(event, HandlerSchemas.verifyEmail());
    if (!parsed.ok) return parsed.response;

    const { token } = parsed.value as AuthApi.VerifyEmailRequest;

    try {
      await this.service.verifyEmail(token);
      logger.info('verify-email ok');
      const body: AuthApi.VerifyEmailResponse = { status: 'verified' };
      return ApiResponder.respond(200, body);
    } catch (err) {
      if (err instanceof AuthServiceError) {
        logger.warn('verify-email failed', { code: err.code });
        return HandlerBase.mapAuthError(err);
      }
      logger.error('verify-email failed with unexpected error');
      return ApiErrors.internal();
    }
  }
}
