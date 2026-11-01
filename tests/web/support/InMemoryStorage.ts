import type { KeyValueStorage } from '../../../apps/web/src/auth/TokenStore.js';

/**
 * In-memory implementation of {@link KeyValueStorage} for tests.
 * Mirrors the behaviour of `window.localStorage` down to the
 * `getItem` returning `null` for a missing key, so the token store
 * does not need special-casing in the test harness.
 */
export class InMemoryStorage implements KeyValueStorage {
  private readonly values: Map<string, string> = new Map();

  public getItem(key: string): string | null {
    const value = this.values.get(key);
    return value === undefined ? null : value;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public size(): number {
    return this.values.size;
  }
}
