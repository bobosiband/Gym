import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { SSMClient } from '@aws-sdk/client-ssm';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { importPKCS8, importSPKI } from 'jose';

import type { AuthConfig } from '../config/AuthConfig.js';
import { SsmConfigLoader } from '../config/SsmConfigLoader.js';
import type { Env } from '../Env.js';
import { EventBridgeEventPublisher } from '../events/EventBridgeEventPublisher.js';
import { NodemailerMailer } from '../mail/NodemailerMailer.js';
import { Argon2PasswordHasher } from '../passwords/Argon2PasswordHasher.js';
import { EmailRateLimiter } from '../rateLimit/EmailRateLimiter.js';
import { DynamoSessionRepository } from '../sessions/DynamoSessionRepository.js';
import { JoseJwtSigner } from '../tokens/JoseJwtSigner.js';
import { DynamoUserRepository } from '../users/DynamoUserRepository.js';
import { SystemClock } from '../util/Clock.js';
import { UuidIdGenerator } from '../util/IdGenerator.js';
import { AuthService } from './AuthService.js';

/**
 * Container for the per-cold-start singletons the auth Lambdas share.
 *
 * Each Lambda invocation reuses the same `AuthService`, the same
 * SMTP transporter inside the mailer, and the same imported key
 * objects. Nothing in here is bound to a specific HTTP request.
 */
export interface AuthRuntime {
  readonly service: AuthService;
  readonly jwtSigner: JoseJwtSigner;
  readonly config: AuthConfig;
  readonly env: Env;
}

/**
 * Builds the auth runtime at cold start.
 *
 * `build` performs the SSM read, imports the keys, constructs the
 * SDK clients and finally wires the dependency graph. The returned
 * `AuthRuntime` can be cached in module scope by each Lambda entry
 * file so warm invocations skip all of this work.
 */
export class AuthServiceFactory {
  private constructor() {
    // factory class; never instantiated
  }

  public static async build(env: Env): Promise<AuthRuntime> {
    const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const ssm = new SSMClient({});
    const eventBridge = new EventBridgeClient({});

    const config = await new SsmConfigLoader(ssm, env.SSM_PARAM_PREFIX).load();

    const privateKey = await importPKCS8(config.jwtPrivateKeyPem, 'ES256');
    const publicKey = await importSPKI(config.jwtPublicKeyPem, 'ES256');

    const users = new DynamoUserRepository(dynamo, env.USERS_TABLE);
    const sessions = new DynamoSessionRepository(dynamo, env.SESSIONS_TABLE);
    const clock = new SystemClock();
    const emailLimiter = new EmailRateLimiter(sessions, clock);
    const mailer = new NodemailerMailer(config.smtp);
    const events = new EventBridgeEventPublisher(eventBridge, env.EVENT_BUS_NAME);
    const passwordHasher = new Argon2PasswordHasher();
    const jwtSigner = new JoseJwtSigner(
      privateKey,
      publicKey,
      env.JWT_KEY_ID,
      env.JWT_ISSUER,
      env.JWT_AUDIENCE
    );
    const ids = new UuidIdGenerator();

    const service = new AuthService({
      users,
      sessions,
      passwordHasher,
      jwtSigner,
      mailer,
      events,
      ids,
      clock,
      emailLimiter,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      verifyUrlBase: env.APP_VERIFY_URL,
      resetUrlBase: env.APP_RESET_URL,
    });

    return { service, jwtSigner, config, env };
  }
}
