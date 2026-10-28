/**
 * Normalised list parameters produced by `ListParamsParser.parse`.
 */
export interface ListParams {
  readonly muscle: string | null;
  readonly equipment: string | null;
  readonly limit: number;
  readonly offset: number;
}
