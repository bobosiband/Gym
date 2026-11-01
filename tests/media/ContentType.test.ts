import { describe, expect, it } from 'vitest';

import { ContentType } from '../../services/media/src/media/ContentType.js';

describe('ContentType.forKey', () => {
  it('maps whitelisted extensions to the right content type', () => {
    expect(ContentType.forKey('pushups/01.gif')).toBe('image/gif');
    expect(ContentType.forKey('pushups/01.jpg')).toBe('image/jpeg');
    expect(ContentType.forKey('pushups/01.jpeg')).toBe('image/jpeg');
    expect(ContentType.forKey('pushups/01.png')).toBe('image/png');
    expect(ContentType.forKey('pushups/01.webp')).toBe('image/webp');
    expect(ContentType.forKey('pushups/01.mp4')).toBe('video/mp4');
    expect(ContentType.forKey('pushups/01.webm')).toBe('video/webm');
  });

  it('normalises the extension to lower case', () => {
    expect(ContentType.forKey('pushups/01.GIF')).toBe('image/gif');
    expect(ContentType.forKey('pushups/01.JPEG')).toBe('image/jpeg');
  });

  it('returns null for extensions not on the allow list', () => {
    expect(ContentType.forKey('pushups/01.html')).toBeNull();
    expect(ContentType.forKey('pushups/01.svg')).toBeNull();
    expect(ContentType.forKey('pushups/01')).toBeNull();
    expect(ContentType.forKey('pushups/01.')).toBeNull();
  });
});
