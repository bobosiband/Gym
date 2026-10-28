/**
 * Raw DB row from the `exercises` table.
 *
 * The DB-facing shape is narrower than the public contract: array columns
 * are JSON strings here. `ExerciseFormatter.fromRow` converts rows into
 * `CatalogueApi.Exercise` values with real arrays.
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
