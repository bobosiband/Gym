import { AchievementService } from './achievements/AchievementService.js';
import { AchievementHandlers } from './achievements/AchievementHandlers.js';
import {
  D1AchievementRepository,
  D1ProcessedEventRepository,
} from './achievements/D1AchievementRepository.js';
import { SystemClock } from './achievements/Clock.js';
import { CryptoIdGenerator } from './achievements/IdGenerator.js';
import { DefaultBadgeRegistryFactory } from './badges/DefaultBadgeRegistryFactory.js';
import type { Env } from './Env.js';
import { LoggingEventPublisher } from './events/EventPublisher.js';
import { HealthHandler } from './HealthHandler.js';
import { ApiErrors } from './http/ApiErrors.js';
import { Cors } from './http/Cors.js';
import { JwksJwtVerifier } from './tokens/JwksJwtVerifier.js';

/**
 * Routes incoming Worker requests to the matching handler. Builds
 * the dependency graph once per request (Cloudflare Worker isolates
 * are cheap to re-instantiate; shared state would leak across
 * tenants).
 */
export class Router {
  private readonly handlers: AchievementHandlers;
  private readonly allowedOrigins: readonly string[];

  public constructor(env: Env) {
    this.allowedOrigins = Cors.parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const repo = new D1AchievementRepository(env.DB);
    const processed = new D1ProcessedEventRepository(env.DB);
    const badges = DefaultBadgeRegistryFactory.create();
    const service = new AchievementService({
      repo,
      processed,
      badges,
      events: new LoggingEventPublisher(),
      clock: new SystemClock(),
      ids: new CryptoIdGenerator(),
    });
    const verifier = new JwksJwtVerifier(env.JWKS_URL, env.JWT_ISSUER, env.JWT_AUDIENCE);
    this.handlers = new AchievementHandlers(service, verifier, env);
  }

  public async route(request: Request): Promise<Response> {
    const method = request.method.toUpperCase();
    if (method === 'OPTIONS') {
      return Cors.preflightResponse(request, this.allowedOrigins);
    }
    const response = await this.dispatch(request, method);
    return Cors.withCorsHeaders(response, request, this.allowedOrigins);
  }

  private async dispatch(request: Request, method: string): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      if (method !== 'GET') return ApiErrors.methodNotAllowed();
      return HealthHandler.handle();
    }
    if (url.pathname === '/achievements') {
      if (method !== 'GET') return ApiErrors.methodNotAllowed();
      return this.handlers.handleListAchievements(request);
    }
    if (url.pathname === '/events') {
      if (method !== 'POST') return ApiErrors.methodNotAllowed();
      return this.handlers.handleEventWebhook(request);
    }
    return ApiErrors.notFound('route not found');
  }
}
