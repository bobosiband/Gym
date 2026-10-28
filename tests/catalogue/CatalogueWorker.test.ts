import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import type {
  ApiError,
  ExerciseDetailResponse,
  ExerciseListResponse,
  HealthResponse,
} from '../../packages/contracts/src/api/catalogue.js';
import type { Env } from '../../services/catalogue/src/Env.js';

import fixtureSql from './fixtures/exercises.sql?raw';
import schema0001 from '../../services/catalogue/migrations/0001_initial.sql?raw';
import schema0002 from '../../services/catalogue/migrations/0002_add_attribution.sql?raw';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}

const BASE_URL = 'http://catalogue.test';

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
  await applySql(schema0002);
  await applySql(fixtureSql);
});

describe('GET /health', () => {
  it('returns 200 with { status: "ok" } and never touches D1', async () => {
    const response = await SELF.fetch(`${BASE_URL}/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as HealthResponse;
    expect(body).toEqual({ status: 'ok' });
  });

  it('returns 405 on non-GET', async () => {
    const response = await SELF.fetch(`${BASE_URL}/health`, { method: 'POST' });
    expect(response.status).toBe(405);
  });
});

describe('OPTIONS preflight', () => {
  it('returns 204 with CORS headers for an allow-listed Origin', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('access-control-allow-methods')).toContain('GET');
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('returns 204 with no CORS headers for a disallowed Origin', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises`, {
      method: 'OPTIONS',
      headers: { origin: 'https://attacker.example' },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('GET /exercises', () => {
  it('returns the full seeded list in name order with cache headers', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as ExerciseListResponse;
    expect(body.total).toBe(3);
    expect(body.exercises.map((exercise) => exercise.name)).toEqual([
      'Bench Press',
      'Deadlift',
      'Squat',
    ]);
    expect(body.exercises[0]?.licence).toBe('CC-BY-SA 4');
    expect(body.exercises[0]?.author).toBe('Roger Reyes');
    expect(body.exercises[0]?.sourceUrl).toContain('wger.de');
  });

  it('adds CORS headers when the request has an allow-listed Origin', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises`, {
      headers: { origin: 'http://localhost:5173' },
    });
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('vary')?.toLowerCase()).toContain('origin');
  });

  it('filters by muscle', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises?muscle=chest`);
    const body = (await response.json()) as ExerciseListResponse;
    expect(body.total).toBe(1);
    expect(body.exercises[0]?.slug).toBe('bench-press-192');
  });

  it('filters by equipment', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises?equipment=barbell`);
    const body = (await response.json()) as ExerciseListResponse;
    expect(body.total).toBe(3);
    expect(body.exercises).toHaveLength(3);
  });

  it('respects limit and keeps total pointing at the full match count', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises?limit=2`);
    const body = (await response.json()) as ExerciseListResponse;
    expect(body.total).toBe(3);
    expect(body.exercises).toHaveLength(2);
    expect(body.exercises.map((exercise) => exercise.name)).toEqual(['Bench Press', 'Deadlift']);
  });

  it('respects offset', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises?offset=1`);
    const body = (await response.json()) as ExerciseListResponse;
    expect(body.exercises[0]?.slug).toBe('deadlift-184');
    expect(body.exercises).toHaveLength(2);
  });

  it('returns 400 BAD_REQUEST when limit is zero', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises?limit=0`);
    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiError;
    expect(body.code).toBe('BAD_REQUEST');
    expect(response.headers.get('cache-control')).toBeNull();
  });

  it('returns 400 BAD_REQUEST when offset is negative', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises?offset=-1`);
    expect(response.status).toBe(400);
  });
});

describe('GET /exercises/:slug', () => {
  it('returns 200 with the matching exercise including attribution', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises/bench-press-192`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    const body = (await response.json()) as ExerciseDetailResponse;
    expect(body.exercise.slug).toBe('bench-press-192');
    expect(body.exercise.muscles).toContain('chest');
    expect(body.exercise.licence).toBe('CC-BY-SA 4');
    expect(body.exercise.author).toBe('Roger Reyes');
    expect(body.exercise.sourceUrl).toBe('https://wger.de/en/exercise/192/view/');
  });

  it('returns 404 for a slug that does not match any row', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises/does-not-exist-999`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as ApiError;
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns 400 for an invalid slug', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises/BAD_SLUG`);
    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiError;
    expect(body.code).toBe('BAD_REQUEST');
  });
});

describe('unknown routes', () => {
  it('returns 404 for an unknown path', async () => {
    const response = await SELF.fetch(`${BASE_URL}/unknown-route`);
    expect(response.status).toBe(404);
  });

  it('returns 405 when POSTing to a known GET path', async () => {
    const response = await SELF.fetch(`${BASE_URL}/exercises`, { method: 'POST' });
    expect(response.status).toBe(405);
  });
});
