import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import type { Env } from '../../services/achievements/src/Env.js';
import schema0001 from '../../services/achievements/migrations/0001_initial.sql?raw';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}

const BASE_URL = 'http://achievements.test';
const INTERNAL_KEY = 'test-internal-key';

async function applySql(sql: string): Promise<void> {
  const uncommented = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const statements = uncommented
    .split(';')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0);
  for (const statement of statements) {
    await env.DB.exec(`${statement.replace(/\s+/g, ' ')};`);
  }
}

beforeAll(async () => {
  await applySql(schema0001);
});

describe('AchievementsWorker /health', () => {
  it('returns 200', async () => {
    const res = await SELF.fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});

describe('AchievementsWorker /events', () => {
  it('rejects a request without the shared secret', async () => {
    const res = await SELF.fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ 'detail-type': 'workout.logged.v1', detail: {} }),
    });
    expect(res.status).toBe(401);
  });

  it('accepts a valid workout.logged.v1 and unlocks the first-workout badge', async () => {
    const body = {
      'detail-type': 'workout.logged.v1',
      detail: {
        eventId: '00000000-0000-4000-8000-000000000011',
        userId: 'u-worker-1',
        workoutId: '00000000-0000-4000-8000-000000000001',
        loggedAt: '2026-11-02T00:00:00Z',
        exerciseId: 'pushup',
        kind: 'pushup',
        reps: 10,
      },
    };
    const res = await SELF.fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-events-key': INTERNAL_KEY,
      },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(204);
    const row = await env.DB.prepare(
      'SELECT badgeId FROM user_achievements WHERE userId = ? AND badgeId = ?'
    )
      .bind('u-worker-1', 'first-workout')
      .first<{ badgeId: string }>();
    expect(row?.badgeId).toBe('first-workout');
  });

  it('rejects an unknown detail type with 400', async () => {
    const res = await SELF.fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-events-key': INTERNAL_KEY,
      },
      body: JSON.stringify({ 'detail-type': 'nope.v1', detail: {} }),
    });
    expect(res.status).toBe(400);
  });
});

describe('AchievementsWorker /achievements', () => {
  it('rejects without a bearer token', async () => {
    const res = await SELF.fetch(`${BASE_URL}/achievements`);
    expect(res.status).toBe(401);
  });
});

describe('AchievementsWorker routing', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await SELF.fetch(`${BASE_URL}/nope`);
    expect(res.status).toBe(404);
  });

  it('answers OPTIONS preflight with CORS headers', async () => {
    const res = await SELF.fetch(`${BASE_URL}/achievements`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('returns 405 for an unsupported method', async () => {
    const res = await SELF.fetch(`${BASE_URL}/health`, { method: 'POST' });
    expect(res.status).toBe(405);
  });
});
