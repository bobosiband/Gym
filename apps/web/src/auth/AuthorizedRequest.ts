import { HttpError } from '../api/HttpError.js';
import type { SessionManager } from './SessionManager.js';

/**
 * Run the given request with a fresh access token, retrying exactly
 * once if the first attempt is rejected with a 401. The retry forces
 * a refresh via {@link SessionManager.refreshNow}; if the refresh
 * itself fails, the error from the refresh propagates and the caller
 * is logged out.
 *
 * Keeping the retry loop here (instead of inside each service's HTTP
 * client) means a 401 from one service cannot accidentally refresh an
 * auth session for an unrelated service: every call site opts in by
 * wrapping the request.
 */
export class AuthorizedRequest {
  private readonly session: SessionManager;

  public constructor(session: SessionManager) {
    this.session = session;
  }

  /**
   * Invoke `run` with a usable access token. Retries once on 401,
   * forwarding every other failure to the caller.
   */
  public async run<T>(run: (accessToken: string) => Promise<T>): Promise<T> {
    const token = await this.session.getFreshAccessToken();
    try {
      return await run(token);
    } catch (error) {
      if (error instanceof HttpError && error.isUnauthorized()) {
        const refreshed = await this.session.refreshNow();
        return run(refreshed);
      }
      throw error;
    }
  }
}
