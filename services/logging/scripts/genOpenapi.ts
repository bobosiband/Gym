#!/usr/bin/env node
/**
 * Generates `docs/swagger/logging.yaml` from the Zod schemas in
 * `@gym/contracts/api/logging`.
 *
 * The committed yaml is the single source of truth consumed by
 * client generators and the Swagger UI. CI runs this script in
 * `tests/logging/OpenApiSpec.test.ts` and fails if the generated
 * bytes do not match the committed file, so the spec cannot drift
 * from the contracts.
 *
 * The `servers` entry is read from
 * `services/logging/openapi.servers.json`, not hardcoded. After
 * the first deploy the owner updates that file with the real
 * API Gateway URL from the `GymLoggingStack` CfnOutput and reruns
 * `pnpm --filter @gym/logging gen:openapi`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import { LoggingApi } from '@gym/contracts';
import { dump } from 'js-yaml';
import { z } from 'zod';

extendZodWithOpenApi(z);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serviceRoot = resolve(scriptDir, '..');
const repoRoot = resolve(serviceRoot, '..', '..');

interface ServersConfig {
  readonly productionUrl: string;
  readonly description: string;
}

function loadServers(): ServersConfig {
  const path = resolve(serviceRoot, 'openapi.servers.json');
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`${path} must be a JSON object`);
  }
  const asRecord = parsed as Record<string, unknown>;
  const productionUrl = asRecord['productionUrl'];
  const description = asRecord['description'];
  if (typeof productionUrl !== 'string' || productionUrl.length === 0) {
    throw new Error(`${path} is missing productionUrl`);
  }
  if (!productionUrl.startsWith('https://')) {
    throw new Error(`${path}: productionUrl must be https://`);
  }
  if (productionUrl.includes('localhost') || productionUrl.includes('127.0.0.1')) {
    throw new Error(`${path}: productionUrl must not point at localhost`);
  }
  if (typeof description !== 'string' || description.length === 0) {
    throw new Error(`${path} is missing description`);
  }
  return { productionUrl, description };
}

function buildDocument(): string {
  const registry = new OpenAPIRegistry();

  const workout = registry.register('Workout', LoggingApi.workoutSchema);
  const errorSchema = registry.register('LoggingApiError', LoggingApi.loggingApiErrorSchema);
  const logReq = registry.register('LogWorkoutRequest', LoggingApi.logWorkoutRequestSchema);
  const logRes = registry.register('LogWorkoutResponse', LoggingApi.logWorkoutResponseSchema);
  const getRes = registry.register('GetWorkoutResponse', LoggingApi.getWorkoutResponseSchema);
  const listRes = registry.register('ListWorkoutsResponse', LoggingApi.listWorkoutsResponseSchema);
  void workout;

  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'ES256 access token issued by services/auth. Verified against the JWKS endpoint.',
  });

  const errorResponses = {
    '400': { description: 'bad request', content: { 'application/json': { schema: errorSchema } } },
    '401': {
      description: 'unauthorized',
      content: { 'application/json': { schema: errorSchema } },
    },
    '403': { description: 'forbidden', content: { 'application/json': { schema: errorSchema } } },
    '404': { description: 'not found', content: { 'application/json': { schema: errorSchema } } },
    '409': { description: 'conflict', content: { 'application/json': { schema: errorSchema } } },
    '413': {
      description: 'payload too large',
      content: { 'application/json': { schema: errorSchema } },
    },
    '429': {
      description: 'too many requests',
      content: { 'application/json': { schema: errorSchema } },
    },
    '500': {
      description: 'internal error',
      content: { 'application/json': { schema: errorSchema } },
    },
    '503': {
      description: 'service unavailable',
      content: { 'application/json': { schema: errorSchema } },
    },
  };

  registry.registerPath({
    method: 'get',
    path: '/health',
    summary: 'Liveness probe',
    description:
      'Returns a self-contained HTML page with the current UTC time. No backing-service reads.',
    responses: {
      '200': {
        description: 'ok',
        content: { 'text/html': { schema: z.string() } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/workouts',
    summary: 'Record a workout',
    description:
      'Persists a workout for the authenticated user and publishes `workout.logged.v1`. Supports an optional `Idempotency-Key` header for safe retries.',
    security: [{ bearerAuth: [] }],
    request: {
      headers: z.object({
        'Idempotency-Key': z
          .string()
          .regex(/^[A-Za-z0-9_-]{8,64}$/)
          .optional()
          .openapi({ description: 'Opaque idempotency key, 8-64 chars from [A-Za-z0-9_-].' }),
      }),
      body: {
        required: true,
        content: { 'application/json': { schema: logReq } },
      },
    },
    responses: {
      '201': {
        description: 'created',
        content: { 'application/json': { schema: logRes } },
      },
      ...errorResponses,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/workouts',
    summary: "List the caller's workouts",
    description: "Returns the authenticated user's workouts, newest first, with cursor pagination.",
    security: [{ bearerAuth: [] }],
    request: {
      query: LoggingApi.listWorkoutsQuerySchema,
    },
    responses: {
      '200': {
        description: 'ok',
        content: { 'application/json': { schema: listRes } },
      },
      ...errorResponses,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/workouts/{workoutId}',
    summary: 'Fetch one workout',
    description:
      'Returns a single workout owned by the caller. 404 is returned both for missing and foreign workouts.',
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ workoutId: z.string().uuid() }),
    },
    responses: {
      '200': {
        description: 'ok',
        content: { 'application/json': { schema: getRes } },
      },
      ...errorResponses,
    },
  });

  const servers = loadServers();
  const generator = new OpenApiGeneratorV31(registry.definitions);
  const document = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Gym logging API',
      version: '1.0.0',
      description:
        'Workout log for the Gym project. Records sets, reps and push-up counts; publishes `workout.logged.v1` on every write. See `services/logging/README.md` for the full spec.',
    },
    servers: [{ url: servers.productionUrl, description: servers.description }],
  });

  return dump(document, { noRefs: true, sortKeys: true, lineWidth: 100 });
}

function main(): void {
  const yaml = buildDocument();
  const outPath = resolve(repoRoot, 'docs', 'swagger', 'logging.yaml');
  writeFileSync(outPath, yaml, 'utf8');
  console.log(`wrote ${outPath} (${yaml.length} bytes)`);
}

main();

/**
 * Pure build step exported for tests to run without touching the
 * filesystem. Returns the generated YAML string that
 * `docs/swagger/logging.yaml` is expected to contain.
 */
export function generateOpenApiYaml(): string {
  return buildDocument();
}
