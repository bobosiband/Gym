import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { SSMClient } from '@aws-sdk/client-ssm';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import type { LoggingConfig } from '../config/LoggingConfig.js';
import { SsmConfigLoader } from '../config/SsmConfigLoader.js';
import type { Env } from '../Env.js';
import { EventBridgeEventPublisher } from '../events/EventBridgeEventPublisher.js';
import { DynamoIdempotencyRepository } from '../idempotency/DynamoIdempotencyRepository.js';
import { JwksJwtVerifier } from '../tokens/JwksJwtVerifier.js';
import type { JwtVerifier } from '../tokens/JwtVerifier.js';
import { SystemClock } from '../util/Clock.js';
import { UuidIdGenerator } from '../util/IdGenerator.js';
import { DynamoWorkoutRepository } from '../workouts/DynamoWorkoutRepository.js';
import { LoggingService } from './LoggingService.js';

/**
 * Container for the per-cold-start singletons the logging Lambdas
 * share. Each invocation reuses the same `LoggingService`, the
 * same remote JWKS set, and the same SDK clients. Nothing in here
 * is bound to a specific HTTP request.
 */
export interface LoggingRuntime {
  readonly service: LoggingService;
  readonly verifier: JwtVerifier;
  readonly config: LoggingConfig;
  readonly env: Env;
}

/**
 * Builds the logging runtime at cold start.
 *
 * `build` performs the SSM read, constructs the SDK clients, wires
 * the dependency graph, and returns a cached-ready runtime. The
 * returned `LoggingRuntime` can be memoised in module scope by
 * each Lambda entry file so warm invocations skip all of this
 * work.
 */
export class LoggingServiceFactory {
  private constructor() {
    // factory class; never instantiated
  }

  public static async build(env: Env): Promise<LoggingRuntime> {
    const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const ssm = new SSMClient({});
    const eventBridge = new EventBridgeClient({});

    const config = await new SsmConfigLoader(ssm, env.SSM_PARAM_PREFIX, env.AUTH_SSM_PREFIX).load();

    const workouts = new DynamoWorkoutRepository(dynamo, env.WORKOUTS_TABLE);
    const idempotency = new DynamoIdempotencyRepository(dynamo, env.IDEMPOTENCY_TABLE);
    const events = new EventBridgeEventPublisher(eventBridge, env.EVENT_BUS_NAME);
    const clock = new SystemClock();
    const ids = new UuidIdGenerator();

    const service = new LoggingService({ workouts, idempotency, events, clock, ids });
    const verifier = new JwksJwtVerifier(config.jwksUrl, config.issuer, config.audience);

    return { service, verifier, config, env };
  }
}
