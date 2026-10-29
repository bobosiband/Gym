import { describe, expect, it } from 'vitest';

import { TokenHasher } from '../../services/auth/src/sessions/TokenHasher.js';

describe('TokenHasher', () => {
  it('generates url-safe tokens', () => {
    for (let i = 0; i < 10; i += 1) {
      const raw = TokenHasher.generateRawToken();
      expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(raw.length).toBeGreaterThan(32);
    }
  });

  it('produces deterministic hashes', () => {
    const raw = 'the-same-input';
    expect(TokenHasher.hashToken(raw)).toBe(TokenHasher.hashToken(raw));
  });

  it('produces different hashes for different inputs', () => {
    expect(TokenHasher.hashToken('a')).not.toBe(TokenHasher.hashToken('b'));
  });

  it('generates unique tokens on each call', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) seen.add(TokenHasher.generateRawToken());
    expect(seen.size).toBe(1000);
  });
});
