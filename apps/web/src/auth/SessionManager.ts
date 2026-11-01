import type { AuthApiClient } from '../api/AuthApiClient.js';
import { HttpError } from '../api/HttpError.js';
import type { AuthTokens } from './AuthTokens.js';
import type { TokenStore } from './TokenStore.js';

/**
 * Callback invoked when the stored session is cleared (either because
 * the user logged out or because a refresh attempt was rejected by
 * the server). Screens subscribe via {@link SessionManager.onLogout}
 * so the UI can send the user back to the login screen in a single
 * place.
 */
export type SessionLogoutListener = () => void;

/**
 * Coordinates token lifecycle for the whole app.
 *
 * The manager wraps {@link TokenStore} and {@link AuthApiClient} to
 * expose three operations that every authenticated screen needs:
 *
 *  - {@link login} persists a fresh token pair.
 *  - {@link getFreshAccessToken} returns a usable access token,
 *    refreshing in-flight if the current one is close to expiry.
 *  - {@link logout} revokes the refresh token server-side (best
 *    effort) and clears local storage, then notifies subscribers.
 *
 * The refresh in-flight promise is cached so that a burst of parallel
 * requests triggers at most one `/auth/refresh` call.
 */
export class SessionManager {
  private readonly tokenStore: TokenStore;
  private readonly authApi: AuthApiClient;
  private readonly listeners: Set<SessionLogoutListener> = new Set();
  private refreshInFlight: Promise<string> | null = null;

  public constructor(tokenStore: TokenStore, authApi: AuthApiClient) {
    this.tokenStore = tokenStore;
    this.authApi = authApi;
  }

  /** Persist the tokens returned by {@link AuthApiClient.login}. */
  public login(tokens: AuthTokens): void {
    this.tokenStore.save(tokens);
  }

  /** `true` when a refresh token is on hand. */
  public hasSession(): boolean {
    return this.tokenStore.hasSession();
  }

  /**
   * Return an access token guaranteed to be valid for at least a
   * minute. Refreshes the session when the stored access token is
   * missing or near expiry. Throws if no refresh token is available
   * or the refresh is rejected.
   */
  public async getFreshAccessToken(): Promise<string> {
    if (!this.tokenStore.isAccessTokenExpiring()) {
      const current = this.tokenStore.readAccessToken();
      if (current !== null) {
        return current;
      }
    }
    return this.refreshNow();
  }

  /**
   * Force a refresh regardless of expiry. Called by screens that have
   * just received a 401 from a resource server. Multiple parallel
   * callers share one in-flight request.
   */
  public async refreshNow(): Promise<string> {
    if (this.refreshInFlight !== null) {
      return this.refreshInFlight;
    }
    const refreshToken = this.tokenStore.readRefreshToken();
    if (refreshToken === null) {
      this.notifyLogout();
      throw new HttpError(401, 'UNAUTHORIZED', 'No refresh token available');
    }
    this.refreshInFlight = this.authApi
      .refresh(refreshToken)
      .then((tokens) => {
        this.tokenStore.save(tokens);
        return tokens.accessToken;
      })
      .catch((error: unknown) => {
        this.tokenStore.clear();
        this.notifyLogout();
        throw error;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });
    return this.refreshInFlight;
  }

  /**
   * Log out: revoke the refresh token server-side where possible,
   * clear storage locally in all cases, then notify listeners.
   */
  public async logout(): Promise<void> {
    const refreshToken = this.tokenStore.readRefreshToken();
    this.tokenStore.clear();
    this.notifyLogout();
    if (refreshToken !== null) {
      try {
        await this.authApi.logout(refreshToken);
      } catch {
        // Best effort. The local tokens are gone, so the user is
        // already logged out from this device's perspective.
      }
    }
  }

  /**
   * Subscribe to logout events. Returns a disposer that removes the
   * listener.
   */
  public onLogout(listener: SessionLogoutListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyLogout(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
