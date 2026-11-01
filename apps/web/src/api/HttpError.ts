/**
 * Error thrown by every HTTP client in `apps/web` when the server
 * responds with a non-2xx status. The {@link code} field mirrors the
 * stable error identifier shared by `auth`, `logging` and
 * `catalogue` APIs; see `packages/contracts/src/api/*.ts` for the
 * canonical values.
 *
 * Screens should match on `code` rather than on the HTTP status so
 * copy stays consistent as backend errors evolve.
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly serverMessage: string;

  public constructor(status: number, code: string, serverMessage: string) {
    super(`HTTP ${status} ${code}: ${serverMessage}`);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.serverMessage = serverMessage;
  }

  /**
   * `true` if the error represents an expired or missing access token.
   * The HTTP client uses this to decide whether a request should be
   * retried after refreshing the session.
   */
  public isUnauthorized(): boolean {
    return this.status === 401 || this.code === 'UNAUTHORIZED';
  }
}
