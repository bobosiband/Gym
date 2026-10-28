import type { CatalogueApi } from '@gym/contracts';

/**
 * Default page size for `GET /exercises` when no limit is supplied.
 */
export const DEFAULT_LIMIT = 50;

/**
 * Maximum page size accepted by `GET /exercises`.
 */
export const MAX_LIMIT = 100;

/**
 * Thrown when request parameters are not well-formed. Handlers catch this
 * and turn it into a 400 Bad Request response.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Normalised list parameters produced by `parseListParams`.
 */
export interface ListParams {
  readonly muscle: string | null;
  readonly equipment: string | null;
  readonly limit: number;
  readonly offset: number;
}

/**
 * A raw DB row with the catalogue's column layout. The DB-facing shape is
 * narrower than the public contract: array columns are JSON strings here.
 */
export interface ExerciseRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly muscles: string;
  readonly equipment: string;
  readonly instructions: string;
  readonly createdAt: string;
}

/**
 * Parse and validate the query string of `GET /exercises`.
 *
 * @throws ValidationError if any parameter is malformed.
 */
export function parseListParams(url: URL): ListParams {
  const muscle = validateFilter('muscle', url.searchParams.get('muscle'));
  const equipment = validateFilter('equipment', url.searchParams.get('equipment'));
  const limit = parsePositiveInteger(
    'limit',
    url.searchParams.get('limit'),
    DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const offset = parseNonNegativeInteger('offset', url.searchParams.get('offset'), 0);
  return { muscle, equipment, limit, offset };
}

function validateFilter(name: string, raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${name} must not be empty`);
  }
  return trimmed;
}

function parsePositiveInteger(
  name: string,
  raw: string | null,
  defaultValue: number,
  max: number
): number {
  if (raw === null) return defaultValue;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError(`${name} must be a positive integer`);
  }
  if (n > max) {
    throw new ValidationError(`${name} must be <= ${max}`);
  }
  return n;
}

function parseNonNegativeInteger(name: string, raw: string | null, defaultValue: number): number {
  if (raw === null) return defaultValue;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new ValidationError(`${name} must be a non-negative integer`);
  }
  return n;
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * True when `slug` is a lowercase kebab-case identifier (letters, digits,
 * single hyphens between tokens, no leading or trailing hyphen).
 */
export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * Convert a DB row into an API-shaped `Exercise`, parsing the JSON-encoded
 * array columns into real string arrays.
 *
 * @throws Error when a JSON column is not a valid array of strings.
 */
export function formatExerciseFromRow(row: ExerciseRow): CatalogueApi.Exercise {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    muscles: parseStringArray(row.muscles),
    equipment: parseStringArray(row.equipment),
    instructions: row.instructions,
    createdAt: row.createdAt,
  };
}

function parseStringArray(raw: string): readonly string[] {
  if (raw.length === 0) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('expected JSON array');
  }
  for (const item of parsed) {
    if (typeof item !== 'string') {
      throw new Error('expected JSON array of strings');
    }
  }
  return parsed as readonly string[];
}
