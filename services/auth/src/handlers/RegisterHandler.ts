import type { AuthApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import { AuthServiceError } from '../service/AuthServiceErrors.js';
import type { AuthService } from '../service/AuthService.js';
import { HandlerBase } from './HandlerBase.js';
import { HandlerSchemas } from './HandlerSchemas.js';

/**
 * Handles `POST /auth/register`.
 *
 * Always responds with the same generic body, whether or not an
 * account already exists, so the endpoint cannot be used to enumerate
 * registered emails. The 202 status is used because the real work
 * (verification email) is still outstanding when the response is
 * sent, which also matches the generic body shape.
 */
export class RegisterHandler {
  public constructor(private readonly service: AuthService) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const logger = HandlerBase.buildLogger('auth.register', event);
    const parsed = HandlerBase.parseBodyOrFail(event, HandlerSchemas.register());
    if (!parsed.ok) return parsed.response;

    const { email, password } = parsed.value as AuthApi.RegisterRequest;

    try {
      await this.service.register(email, password);
      logger.info('register ok');
      const body: AuthApi.RegisterResponse = { status: 'pending_verification' };
      return ApiResponder.respond(202, body);
    } catch (err) {
      if (err instanceof AuthServiceError) {
        logger.warn('register failed', { code: err.code });
        if (err.code === 'EMAIL_RATE_LIMITED') {
          return ApiErrors.tooManyRequests('too many requests for this email');
        }
        if (err.code === 'WEAK_PASSWORD') {
          return ApiErrors.badRequest('password must be between 12 and 128 characters');
        }
      }
      logger.error('register failed with unexpected error');
      return ApiErrors.internal();
    }
  }
}
