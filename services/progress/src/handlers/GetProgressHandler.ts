import type { ProgressApi } from '@gym/contracts';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { ProgressService } from '../progress/ProgressService.js';
import { ProgressServiceError } from '../progress/ProgressServiceErrors.js';
import type { JwtVerifier } from '../tokens/JwtVerifier.js';
import { HandlerBase } from './HandlerBase.js';

/**
 * Handler for `GET /progress`. Verifies the bearer JWT and returns
 * the caller's state. Seeds a fresh row for a new user.
 */
export class GetProgressHandler {
  public constructor(
    private readonly service: ProgressService,
    private readonly verifier: JwtVerifier
  ) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const bearer = HandlerBase.readBearerToken(event);
    if (bearer === null) {
      return ApiErrors.unauthorized('invalid credentials');
    }
    let userId: string;
    try {
      const claims = await this.verifier.verify(bearer);
      userId = claims.sub;
    } catch {
      return ApiErrors.unauthorized('invalid credentials');
    }
    try {
      const progress = await this.service.getProgress(userId);
      const body: ProgressApi.GetProgressResponse = { progress };
      return ApiResponder.respond(200, body);
    } catch (err) {
      if (err instanceof ProgressServiceError) {
        return HandlerBase.mapServiceError(err);
      }
      return ApiErrors.internal();
    }
  }
}
