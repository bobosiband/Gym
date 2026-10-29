import { describe, expect, it } from 'vitest';

import { EmailNormaliser } from '../../services/auth/src/util/EmailNormaliser.js';

describe('EmailNormaliser', () => {
  it('lowercases', () => {
    expect(EmailNormaliser.normalise('Alice@Example.com')).toBe('alice@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(EmailNormaliser.normalise('  alice@example.com  ')).toBe('alice@example.com');
  });

  it('does not fold dots or strip plus tags', () => {
    expect(EmailNormaliser.normalise('a.b+tag@example.com')).toBe('a.b+tag@example.com');
  });
});
