import { describe, expect, it } from 'vitest';

import { MediaKey } from '../../services/media/src/media/MediaKey.js';

describe('MediaKey.isValid', () => {
  it('accepts a lower-case kebab path with an extension', () => {
    expect(MediaKey.isValid('pushups/wide-grip.gif')).toBe(true);
    expect(MediaKey.isValid('bench-press/01.png')).toBe(true);
  });

  it('rejects empty, too long, or absolute keys', () => {
    expect(MediaKey.isValid('')).toBe(false);
    expect(MediaKey.isValid('/leading-slash.gif')).toBe(false);
    expect(MediaKey.isValid('trailing-slash/')).toBe(false);
    expect(MediaKey.isValid('a'.repeat(513))).toBe(false);
  });

  it('rejects path traversal and dot segments', () => {
    expect(MediaKey.isValid('../etc/passwd')).toBe(false);
    expect(MediaKey.isValid('a/../b.gif')).toBe(false);
    expect(MediaKey.isValid('./a.gif')).toBe(false);
  });

  it('rejects uppercase, spaces, and other unsafe characters', () => {
    expect(MediaKey.isValid('Pushups/wide.gif')).toBe(false);
    expect(MediaKey.isValid('pushups/wide grip.gif')).toBe(false);
    expect(MediaKey.isValid('pushups/wide:grip.gif')).toBe(false);
  });
});

describe('MediaKey.extract', () => {
  it('extracts the key from a /media/<key> URL', () => {
    expect(MediaKey.extract('/media/pushups/01.gif')).toBe('pushups/01.gif');
  });

  it('returns null for a URL outside the /media/ prefix', () => {
    expect(MediaKey.extract('/health')).toBeNull();
    expect(MediaKey.extract('/media')).toBeNull();
  });

  it('returns null for an invalid key', () => {
    expect(MediaKey.extract('/media/../etc/passwd')).toBeNull();
  });
});
