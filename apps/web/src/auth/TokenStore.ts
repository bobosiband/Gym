import type { AuthTokens } from './AuthTokens.js';

/**
 * Minimal storage shape the token store needs. `localStorage` on the
 * browser satisfies this interface directly; tests pass an in-memory
 * fake so no real browser storage is touched.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Internal shape persisted to storage. Written through
 * `JSON.stringify` and read back through `JSON.parse` so the storage
 * driver does not need to know the layout.
 */
interface StoredTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAtMs: number;
}

const STORAGE_KEY = 'gym.auth.tokens.v1';
const EARLY_REFRESH_WINDOW_MS = 60_000;

/**
 * Durable store for the user's authentication tokens.
 *
 * The access and refresh tokens live together under a single key so a
 * logout clears both atomically and so other tabs can observe the
 * change via the native `storage` event. Access-token expiry is kept
 * as an absolute millisecond timestamp so callers do not have to
 * track the clock.
 *
 * The store deliberately holds no in-process cache: every read goes
 * through the storage driver, so a `storage` event in another tab is
 * reflected immediately on the next call.
 */
export class TokenStore {
  private readonly storage: KeyValueStorage;
  private readonly now: () => number;

  public constructor(storage: KeyValueStorage, now: () => number = () => Date.now()) {
    this.storage = storage;
    this.now = now;
  }

  /**
   * Persist the given tokens. `expiresInSeconds` is converted to an
   * absolute timestamp against the injected clock so expiry is
   * independent of the device clock drifting after the write.
   */
  public save(tokens: AuthTokens): void {
    const payload: StoredTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessExpiresAtMs: this.now() + tokens.expiresInSeconds * 1000,
    };
    this.storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  /**
   * Return the stored access token, or `null` if no tokens are
   * persisted or the stored blob is malformed.
   */
  public readAccessToken(): string | null {
    const stored = this.read();
    return stored === null ? null : stored.accessToken;
  }

  /**
   * Return the stored refresh token, or `null` if no tokens are
   * persisted or the stored blob is malformed.
   */
  public readRefreshToken(): string | null {
    const stored = this.read();
    return stored === null ? null : stored.refreshToken;
  }

  /**
   * `true` when there is no stored access token or when the access
   * token is within {@link EARLY_REFRESH_WINDOW_MS} of expiry. Clients
   * should pre-emptively refresh when this returns `true` rather than
   * waiting for a 401.
   */
  public isAccessTokenExpiring(): boolean {
    const stored = this.read();
    if (stored === null) {
      return true;
    }
    return stored.accessExpiresAtMs - this.now() <= EARLY_REFRESH_WINDOW_MS;
  }

  /**
   * `true` when a refresh token is present. Used by the router to
   * decide whether to show the login screen or the home screen on
   * cold start.
   */
  public hasSession(): boolean {
    return this.read() !== null;
  }

  /**
   * Remove any stored tokens. Idempotent.
   */
  public clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }

  private read(): StoredTokens | null {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<StoredTokens>;
      if (
        typeof parsed.accessToken !== 'string' ||
        typeof parsed.refreshToken !== 'string' ||
        typeof parsed.accessExpiresAtMs !== 'number'
      ) {
        return null;
      }
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        accessExpiresAtMs: parsed.accessExpiresAtMs,
      };
    } catch {
      return null;
    }
  }
}
