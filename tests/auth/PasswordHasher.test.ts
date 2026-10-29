import { describe, expect, it } from 'vitest';

import { Argon2PasswordHasher } from '../../services/auth/src/passwords/Argon2PasswordHasher.js';
import { PasswordPolicy } from '../../services/auth/src/passwords/PasswordPolicy.js';

describe('Argon2PasswordHasher', () => {
  it('produces an argon2id encoded hash', async () => {
    const hasher = new Argon2PasswordHasher();
    const encoded = await hasher.hash('correct horse battery staple');
    expect(encoded.startsWith('$argon2id$')).toBe(true);
  });

  it('verifies the correct password', async () => {
    const hasher = new Argon2PasswordHasher();
    const encoded = await hasher.hash('correct horse battery staple');
    expect(await hasher.verify(encoded, 'correct horse battery staple')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hasher = new Argon2PasswordHasher();
    const encoded = await hasher.hash('correct horse battery staple');
    expect(await hasher.verify(encoded, 'wrong horse battery staple')).toBe(false);
  });

  it('swallows an invalid encoded hash', async () => {
    const hasher = new Argon2PasswordHasher();
    expect(await hasher.verify('not-a-hash', 'anything')).toBe(false);
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const hasher = new Argon2PasswordHasher();
    const a = await hasher.hash('correct horse battery staple');
    const b = await hasher.hash('correct horse battery staple');
    expect(a).not.toEqual(b);
  });
});

describe('PasswordPolicy', () => {
  it('accepts a 12-character password', () => {
    expect(PasswordPolicy.isAcceptable('a'.repeat(12))).toBe(true);
  });

  it('rejects an 11-character password', () => {
    expect(PasswordPolicy.isAcceptable('a'.repeat(11))).toBe(false);
  });

  it('accepts a 128-character password', () => {
    expect(PasswordPolicy.isAcceptable('a'.repeat(128))).toBe(true);
  });

  it('rejects a 129-character password', () => {
    expect(PasswordPolicy.isAcceptable('a'.repeat(129))).toBe(false);
  });
});
