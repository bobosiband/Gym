import { HttpError } from './HttpError.js';

/**
 * Options accepted by {@link FetchHttpClient.request}. Mirrors the
 * subset of `RequestInit` the app actually uses.
 */
export interface HttpRequestOptions {
  readonly method: 'GET' | 'POST' | 'DELETE';
  readonly url: string;
  readonly body?: unknown;
  readonly bearerToken?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * Minimum shape of the global `fetch` function needed by the client.
 * Tests pass a stub so no network requests leave the test runner.
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Thin typed wrapper around `fetch`. Centralises JSON encoding,
 * bearer-token injection, and the mapping from a non-2xx response to
 * an {@link HttpError}. No retries, no exponential backoff, no refresh
 * logic lives here: those behaviours sit in the service-specific
 * clients so a 401 on the catalogue cannot accidentally refresh an
 * auth session.
 */
export class FetchHttpClient {
  private readonly fetchFn: FetchLike;

  public constructor(fetchFn: FetchLike = (input, init) => fetch(input, init)) {
    this.fetchFn = fetchFn;
  }

  /**
   * Perform the request and return the parsed JSON body. A 204 or an
   * empty body returns `undefined` cast to `T`.
   *
   * @throws {HttpError} on any non-2xx response.
   */
  public async request<T>(options: HttpRequestOptions): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...(options.headers ?? {}),
    };
    const init: RequestInit = { method: options.method, headers };
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    if (options.bearerToken !== undefined) {
      headers['authorization'] = `Bearer ${options.bearerToken}`;
    }
    const response = await this.fetchFn(options.url, init);
    if (!response.ok) {
      await this.throwHttpError(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    const text = await response.text();
    if (text.length === 0) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  private async throwHttpError(response: Response): Promise<never> {
    let code = 'UNKNOWN';
    let message = response.statusText || 'Request failed';
    try {
      const text = await response.text();
      if (text.length > 0) {
        const parsed = JSON.parse(text) as { code?: unknown; message?: unknown };
        if (typeof parsed.code === 'string') {
          code = parsed.code;
        }
        if (typeof parsed.message === 'string') {
          message = parsed.message;
        }
      }
    } catch {
      // The server returned a non-JSON body on an error. Keep the
      // defaults; the status alone is enough for screens to react.
    }
    throw new HttpError(response.status, code, message);
  }
}
