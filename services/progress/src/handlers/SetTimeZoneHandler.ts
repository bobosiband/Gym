import { ProgressApi } from '@gym/contracts';
import { setTimeZoneRequestSchema } from '@gym/contracts/api/progress';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { ApiErrors } from '../http/ApiErrors.js';
import { ApiResponder } from '../http/ApiResponder.js';
import type { ProgressService } from '../progress/ProgressService.js';
import { ProgressServiceError } from '../progress/ProgressServiceErrors.js';
import type { JwtVerifier } from '../tokens/JwtVerifier.js';
import { HandlerBase } from './HandlerBase.js';

/**
 * Handler for `PUT /progress/timezone`.
 */
export class SetTimeZoneHandler {
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
    const parsed = HandlerBase.parseBodyOrFail(event, setTimeZoneRequestSchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    try {
      const progress = await this.service.setTimeZone(userId, parsed.value.timeZone);
      const body: ProgressApi.SetTimeZoneResponse = { progress };
      return ApiResponder.respond(200, body);
    } catch (err) {
      if (err instanceof ProgressServiceError) {
        return HandlerBase.mapServiceError(err);
      }
      return ApiErrors.internal();
    }
  }
}
