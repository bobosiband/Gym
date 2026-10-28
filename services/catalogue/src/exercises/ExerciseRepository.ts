import type { CatalogueApi } from '@gym/contracts';

import type { ListParams } from './ListParams.js';

/**
 * Read-only data access for the catalogue.
 *
 * Depending on this interface (rather than the D1 implementation) keeps
 * HTTP handlers unit-testable and lets later stages swap in alternative
 * stores if ever needed.
 */
export interface ExerciseRepository {
  listExercises(params: ListParams): Promise<readonly CatalogueApi.Exercise[]>;
  countExercises(params: ListParams): Promise<number>;
  getExerciseBySlug(slug: string): Promise<CatalogueApi.Exercise | null>;
}
