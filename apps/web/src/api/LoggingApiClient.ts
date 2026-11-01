import type { LoggingApi } from '@gym/contracts';

import type { FetchHttpClient } from './FetchHttpClient.js';

/**
 * Options for {@link LoggingApiClient.logWorkout}. The idempotency key
 * is optional per the service contract: callers that may retry a
 * request (the push-up counter on session end, for example) should
 * generate one so the write is replay-safe.
 */
export interface LogWorkoutOptions {
  readonly request: LoggingApi.LogWorkoutRequest;
  readonly accessToken: string;
  readonly idempotencyKey?: string;
}

/**
 * Options for {@link LoggingApiClient.listWorkouts}. `cursor` is an
 * opaque server-produced string so clients should not construct one.
 */
export interface ListWorkoutsOptions {
  readonly accessToken: string;
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Typed HTTP client for `services/logging`.
 *
 * Mirrors the endpoints documented in `services/logging/README.md`.
 * The client does not refresh the bearer token on 401; the calling
 * screen is responsible for that so refresh happens exactly once per
 * expired-token round-trip and never duplicates writes.
 */
export class LoggingApiClient {
  private readonly http: FetchHttpClient;
  private readonly baseUrl: string;

  public constructor(http: FetchHttpClient, baseUrl: string) {
    this.http = http;
    this.baseUrl = baseUrl;
  }

  /**
   * `POST /workouts`. Writes the row, publishes `workout.logged.v1`,
   * and returns the stored record. Pass an `idempotencyKey` when the
   * call may be retried.
   */
  public async logWorkout(options: LogWorkoutOptions): Promise<LoggingApi.LogWorkoutResponse> {
    const headers: Record<string, string> =
      options.idempotencyKey !== undefined ? { 'idempotency-key': options.idempotencyKey } : {};
    return this.http.request<LoggingApi.LogWorkoutResponse>({
      method: 'POST',
      url: `${this.baseUrl}/workouts`,
      body: options.request,
      bearerToken: options.accessToken,
      headers,
    });
  }

  /**
   * `GET /workouts`. Returns a page of workouts for the caller,
   * newest first.
   */
  public async listWorkouts(
    options: ListWorkoutsOptions
  ): Promise<LoggingApi.ListWorkoutsResponse> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options.cursor !== undefined) {
      params.set('cursor', options.cursor);
    }
    const suffix = params.toString();
    const url =
      suffix.length > 0 ? `${this.baseUrl}/workouts?${suffix}` : `${this.baseUrl}/workouts`;
    return this.http.request<LoggingApi.ListWorkoutsResponse>({
      method: 'GET',
      url,
      bearerToken: options.accessToken,
    });
  }
}
