import type { CatalogueApi } from '@gym/contracts';

import { jsonResponse } from './json.js';

/**
 * Build a 400 Bad Request response.
 */
export function badRequest(message: string): Response {
  const body: CatalogueApi.ApiError = { code: 'BAD_REQUEST', message };
  return jsonResponse(400, body);
}

/**
 * Build a 404 Not Found response.
 */
export function notFound(message: string): Response {
  const body: CatalogueApi.ApiError = { code: 'NOT_FOUND', message };
  return jsonResponse(404, body);
}

/**
 * Build a 405 Method Not Allowed response.
 */
export function methodNotAllowed(): Response {
  const body: CatalogueApi.ApiError = {
    code: 'METHOD_NOT_ALLOWED',
    message: 'method not allowed',
  };
  return jsonResponse(405, body);
}

/**
 * Build a 500 Internal Server Error response.
 */
export function internalServerError(message: string): Response {
  const body: CatalogueApi.ApiError = { code: 'INTERNAL', message };
  return jsonResponse(500, body);
}
