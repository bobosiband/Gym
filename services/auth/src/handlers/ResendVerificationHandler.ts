import type { AuthApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { AuthService } from '../service/AuthService.js';
import { AuthServiceError } from '../service/AuthServiceErrors.js';
import { HandlerBase } from './HandlerBase.js';
import { HandlerSchemas } from './HandlerSchemas.js';

/**
 * Handles `POST /auth/resend-verification`.
 *
 * Returns the same body for unknown and known accounts to avoid
 * email enumeration.
 */
export class ResendVerificationHandler {
  public constructor(private readonly service: AuthService) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('auth.resend-verification', event);
    const parsed = HandlerBase.parseBodyOrFail(event, HandlerSchemas.resendVerification());
    if (!parsed.ok) return parsed.response;

    const { email } = parsed.value as AuthApi.ResendVerificationRequest;

    try {
      await this.service.resendVerification(email);
      logger.info('resend-verification ok');
      const body: AuthApi.ResendVerificationResponse = { status: 'pending_verification' };
      return ApiResponder.respond(202, body);
    } catch (err) {
      if (err instanceof AuthServiceError) {
        logger.warn('resend-verification failed', { code: err.code });
        if (err.code === 'EMAIL_RATE_LIMITED') {
          return ApiErrors.tooManyRequests('too many requests for this email');
        }
      }
      logger.error('resend-verification failed with unexpected error');
      return ApiErrors.internal();
    }
  }
}
