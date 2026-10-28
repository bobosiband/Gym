import type { CatalogueApi } from '@gym/contracts';

import type { ExerciseRow } from './ExerciseRow.js';

/**
 * Converts raw DB rows into API-shaped `Exercise` values.
 *
 * Stateless; use via static methods.
 */
export class ExerciseFormatter {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Convert a DB row into an API-shaped `Exercise`, parsing JSON-encoded
   * array columns into real string arrays.
   *
   * @throws Error when a JSON column is not a valid array of strings.
   */
  public static fromRow(row: ExerciseRow): CatalogueApi.Exercise {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      muscles: ExerciseFormatter.parseStringArray(row.muscles),
      equipment: ExerciseFormatter.parseStringArray(row.equipment),
      instructions: row.instructions,
      createdAt: row.createdAt,
    };
  }

  private static parseStringArray(raw: string): readonly string[] {
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
}
