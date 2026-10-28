import type { ListParams } from './ListParams.js';
import { ValidationError } from './ValidationError.js';

/**
 * Parses and validates the query string of `GET /exercises`.
 *
 * Stateless; use via static methods. All failures surface as
 * `ValidationError`, which handlers map to a 400 Bad Request response.
 */
export class ListParamsParser {
  /**
   * Default page size when the `limit` query param is absent.
   */
  public static readonly DEFAULT_LIMIT = 50;

  /**
   * Maximum page size accepted by the API.
   */
  public static readonly MAX_LIMIT = 100;

  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Parse the query string into normalised list parameters.
   *
   * @throws ValidationError when any parameter is malformed.
   */
  public static parse(url: URL): ListParams {
    const muscle = ListParamsParser.validateFilter('muscle', url.searchParams.get('muscle'));
    const equipment = ListParamsParser.validateFilter(
      'equipment',
      url.searchParams.get('equipment')
    );
    const limit = ListParamsParser.parsePositiveInteger(
      'limit',
      url.searchParams.get('limit'),
      ListParamsParser.DEFAULT_LIMIT,
      ListParamsParser.MAX_LIMIT
    );
    const offset = ListParamsParser.parseNonNegativeInteger(
      'offset',
      url.searchParams.get('offset'),
      0
    );
    return { muscle, equipment, limit, offset };
  }

  private static validateFilter(name: string, raw: string | null): string | null {
    if (raw === null) return null;
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new ValidationError(`${name} must not be empty`);
    }
    return trimmed;
  }

  private static parsePositiveInteger(
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

  private static parseNonNegativeInteger(
    name: string,
    raw: string | null,
    defaultValue: number
  ): number {
    if (raw === null) return defaultValue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      throw new ValidationError(`${name} must be a non-negative integer`);
    }
    return n;
  }
}
