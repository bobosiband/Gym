import { describe, expect, it } from 'vitest';

import { AppPublicUrl } from '../../infra/auth/lib/AppPublicUrl.js';

describe('AppPublicUrl.resolve', () => {
  it('rejects undefined with an actionable message', () => {
    expect(() => AppPublicUrl.resolve(undefined)).toThrow(/APP_PUBLIC_URL must be set/);
  });

  it('rejects an empty string', () => {
    expect(() => AppPublicUrl.resolve('')).toThrow(/APP_PUBLIC_URL is empty/);
  });

  it("rejects '*' and points the reader at ALLOWED_ORIGINS", () => {
    expect(() => AppPublicUrl.resolve('*')).toThrow(/ALLOWED_ORIGINS/);
  });

  it('rejects a relative path', () => {
    expect(() => AppPublicUrl.resolve('/verify')).toThrow(/absolute URL/);
  });

  it('rejects a non-URL string', () => {
    expect(() => AppPublicUrl.resolve('not a url')).toThrow(/absolute URL/);
  });

  it('rejects http (non-https) origins', () => {
    expect(() => AppPublicUrl.resolve('http://gym.example')).toThrow(/must use https/);
  });

  it('accepts the deployed Vercel URL unchanged', () => {
    expect(AppPublicUrl.resolve('https://gym-phi-blush-16.vercel.app')).toBe(
      'https://gym-phi-blush-16.vercel.app'
    );
  });

  it('rejects a trailing slash on the origin', () => {
    expect(() => AppPublicUrl.resolve('https://gym.example.com/')).toThrow(/trailing slash/);
  });

  it('rejects a trailing slash on a path prefix', () => {
    expect(() => AppPublicUrl.resolve('https://gym.example.com/app/')).toThrow(/trailing slash/);
  });

  it('trims leading and trailing whitespace', () => {
    expect(AppPublicUrl.resolve('  https://gym.example.com  ')).toBe('https://gym.example.com');
  });

  it('keeps a non-trivial path prefix intact', () => {
    expect(AppPublicUrl.resolve('https://gym.example.com/app')).toBe('https://gym.example.com/app');
  });
});
