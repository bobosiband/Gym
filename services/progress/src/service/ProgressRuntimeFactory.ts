import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { SSMClient } from '@aws-sdk/client-ssm';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DefaultExerciseRegistryFactory } from '@gym/exercise-pushup';

import type { Env } from '../Env.js';
import type { ProgressConfig } from '../config/ProgressConfig.js';
import { SsmConfigLoader } from '../config/SsmConfigLoader.js';
import { EventBridgeEventPublisher } from '../events/EventBridgeEventPublisher.js';
import { DynamoProcessedEventRepository } from '../progress/DynamoProcessedEventRepository.js';
import { DynamoProgressRepository } from '../progress/DynamoProgressRepository.js';
import { ProgressService } from '../progress/ProgressService.js';
import { JwksJwtVerifier } from '../tokens/JwksJwtVerifier.js';
import type { JwtVerifier } from '../tokens/JwtVerifier.js';
import { SystemClock } from '../util/Clock.js';
import { CryptoIdGenerator } from '../util/IdGenerator.js';

/**
 * Bundle of production-wired dependencies produced by
 * {@link ProgressRuntimeFactory.build}. The Lambda runtime caches
 * this across warm invocations so the SSM read and JWKS prime run
 * exactly once per cold start.
 */
export interface ProgressRuntime {
  readonly service: ProgressService;
  readonly verifier: JwtVerifier;
  readonly config: ProgressConfig;
}

export class ProgressRuntimeFactory {
  private constructor() {
    // utility class; never instantiated
  }

  public static async build(env: Env): Promise<ProgressRuntime> {
    const dynamoClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: env.AWS_REGION })
    );
    const ssmClient = new SSMClient({ region: env.AWS_REGION });
    const eventsClient = new EventBridgeClient({ region: env.AWS_REGION });
    const config = await new SsmConfigLoader(ssmClient, env.SSM_PARAM_PREFIX).load();
    const clock = new SystemClock();
    const ids = new CryptoIdGenerator();
    const exercises = DefaultExerciseRegistryFactory.create();
    const service = new ProgressService({
      progress: new DynamoProgressRepository(dynamoClient, env.STATE_TABLE_NAME),
      processed: new DynamoProcessedEventRepository(
        dynamoClient,
        env.PROCESSED_EVENT_TABLE_NAME,
        clock
      ),
      events: new EventBridgeEventPublisher(eventsClient, env.EVENT_BUS_NAME),
      clock,
      ids,
      exercises,
    });
    const verifier = new JwksJwtVerifier(config.jwksUrl, config.jwtIssuer, config.jwtAudience);
    return { service, verifier, config };
  }
}
