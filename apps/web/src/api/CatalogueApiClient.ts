import type { CatalogueApi } from '@gym/contracts';

import type { FetchHttpClient } from './FetchHttpClient.js';

/**
 * Options for {@link CatalogueApiClient.listExercises}.
 */
export interface ListExercisesOptions {
  readonly muscle?: string;
  readonly equipment?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Typed HTTP client for `services/catalogue`.
 *
 * The catalogue is public: no bearer token is attached. Clients that
 * display exercise content must preserve the `licence`, `author`, and
 * `sourceUrl` fields in every response per `docs/SOURCES.md`.
 */
export class CatalogueApiClient {
  private readonly http: FetchHttpClient;
  private readonly baseUrl: string;

  public constructor(http: FetchHttpClient, baseUrl: string) {
    this.http = http;
    this.baseUrl = baseUrl;
  }

  /** `GET /exercises` with optional filters. */
  public async listExercises(
    options: ListExercisesOptions = {}
  ): Promise<CatalogueApi.ExerciseListResponse> {
    const params = new URLSearchParams();
    if (options.muscle !== undefined) {
      params.set('muscle', options.muscle);
    }
    if (options.equipment !== undefined) {
      params.set('equipment', options.equipment);
    }
    if (options.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options.offset !== undefined) {
      params.set('offset', String(options.offset));
    }
    const suffix = params.toString();
    const url =
      suffix.length > 0 ? `${this.baseUrl}/exercises?${suffix}` : `${this.baseUrl}/exercises`;
    return this.http.request<CatalogueApi.ExerciseListResponse>({ method: 'GET', url });
  }
}
