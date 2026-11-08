import {
  achievementsApiErrorSchema,
  listAchievementsResponseSchema,
  type AchievementsApi,
} from '@gym/contracts/api/achievements';
import { progressLevelUpV1Schema } from '@gym/contracts/events/progressLevelUp.v1';
import { workoutLoggedV1Schema } from '@gym/contracts/events/workoutLogged.v1';

import { ApiErrors } from '../http/ApiErrors.js';
import { JsonResponder } from '../http/JsonResponder.js';
import type { JwtVerifier } from '../tokens/JwtVerifier.js';
import { AchievementService } from './AchievementService.js';
import type { Env } from '../Env.js';

const MAX_BODY_BYTES = 8 * 1024;

const EVENT_ENVELOPE_PATTERN = /^(workout\.logged\.v1|progress\.level_up\.v1)$/;

/** Minimal subset of an EventBridge envelope we accept at the webhook. */
interface EventEnvelope {
  readonly detailType: string;
  readonly detail: unknown;
}

/**
 * HTTP handlers for the achievements Worker.
 *
 * Two public endpoints:
 *
 *  - `GET /achievements`: JWT-auth via the JWKS verifier; returns
 *    the caller's unlocked badges.
 *  - `POST /events`: shared-secret auth via `INTERNAL_EVENTS_KEY`.
 *    Accepts an EventBridge-shaped envelope and dispatches to the
 *    service.
 */
export class AchievementHandlers {
  public constructor(
    private readonly service: AchievementService,
    private readonly verifier: JwtVerifier,
    private readonly env: Env
  ) {}

  public async handleListAchievements(request: Request): Promise<Response> {
    const bearer = AchievementHandlers.readBearerToken(request);
    if (bearer === null) {
      return ApiErrors.unauthorized();
    }
    let userId: string;
    try {
      const claims = await this.verifier.verify(bearer);
      userId = claims.sub;
    } catch {
      return ApiErrors.unauthorized();
    }
    const records = await this.service.listAchievements(userId);
    const achievements: AchievementsApi.Achievement[] = records.map((record) => ({
      badgeId: record.badgeId,
      name: record.name,
      description: record.description,
      unlockedAt: record.unlockedAt,
    }));
    const body: AchievementsApi.ListAchievementsResponse = { achievements };
    const parsed = listAchievementsResponseSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.internalServerError();
    }
    return JsonResponder.respond(200, parsed.data);
  }

  public async handleEventWebhook(request: Request): Promise<Response> {
    const provided = request.headers.get('x-internal-events-key');
    if (provided === null || provided !== this.env.INTERNAL_EVENTS_KEY) {
      return ApiErrors.unauthorized();
    }
    const parsed = await AchievementHandlers.readEnvelope(request);
    if (parsed.kind === 'error') {
      return parsed.response;
    }
    const envelope = parsed.value;
    if (!EVENT_ENVELOPE_PATTERN.test(envelope.detailType)) {
      return ApiErrors.badRequest(`unsupported detail-type: ${envelope.detailType}`);
    }
    try {
      if (envelope.detailType === 'workout.logged.v1') {
        const detail = workoutLoggedV1Schema.safeParse(envelope.detail);
        if (!detail.success) {
          return ApiErrors.badRequest('invalid workout.logged.v1 detail');
        }
        await this.service.handleWorkoutLogged(detail.data);
      } else {
        const detail = progressLevelUpV1Schema.safeParse(envelope.detail);
        if (!detail.success) {
          return ApiErrors.badRequest('invalid progress.level_up.v1 detail');
        }
        await this.service.handleProgressLevelUp(detail.data);
      }
    } catch (err) {
      console.error('achievements: event handler failed', err);
      return ApiErrors.internalServerError();
    }
    return new Response(null, { status: 204 });
  }

  private static async readEnvelope(
    request: Request
  ): Promise<{ kind: 'ok'; value: EventEnvelope } | { kind: 'error'; response: Response }> {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return {
        kind: 'error',
        response: ApiErrors.badRequest('content-type must be application/json'),
      };
    }
    const raw = await request.text();
    if (raw.length === 0) {
      return { kind: 'error', response: ApiErrors.badRequest('request body required') };
    }
    if (raw.length > MAX_BODY_BYTES) {
      return { kind: 'error', response: ApiErrors.badRequest('payload too large') };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { kind: 'error', response: ApiErrors.badRequest('invalid JSON') };
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return { kind: 'error', response: ApiErrors.badRequest('envelope must be an object') };
    }
    const envelope = parsed as Record<string, unknown>;
    const detailType = envelope['detail-type'] ?? envelope['detailType'];
    if (typeof detailType !== 'string') {
      return {
        kind: 'error',
        response: ApiErrors.badRequest('envelope.detail-type must be a string'),
      };
    }
    return { kind: 'ok', value: { detailType, detail: envelope['detail'] } };
  }

  private static readBearerToken(request: Request): string | null {
    const value = request.headers.get('authorization');
    if (value === null) {
      return null;
    }
    const match = value.match(/^Bearer\s+(.+)$/i);
    return match === null ? null : (match[1] ?? null);
  }
}

// Keep the error schema import from being stripped by bundlers when
// only types are used above.
void achievementsApiErrorSchema;
