import { describe, expect, it } from 'vitest';

import { Cors } from '../../services/media/src/Cors.js';

describe('Cors.parseAllowedOrigins', () => {
  it('returns an empty list for an unset value', () => {
    expect(Cors.parseAllowedOrigins(undefined)).toEqual([]);
    expect(Cors.parseAllowedOrigins('')).toEqual([]);
  });

  it('splits a comma-separated list and trims entries', () => {
    expect(Cors.parseAllowedOrigins('https://a.example, https://b.example')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('preserves the lone * entry', () => {
    expect(Cors.parseAllowedOrigins('*')).toEqual(['*']);
  });
});

describe('Cors.preflightResponse', () => {
  it('answers with access-control-allow-origin: * for a wildcard allow list', () => {
    const request = new Request('https://host/media/a.gif', {
      method: 'OPTIONS',
      headers: { origin: 'https://any.example' },
    });
    const response = Cors.preflightResponse(request, ['*']);
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toContain('GET');
    expect(response.headers.get('vary')).toBeNull();
  });

  it('echoes the Origin for an exact match', () => {
    const request = new Request('https://host/media/a.gif', {
      method: 'OPTIONS',
      headers: { origin: 'https://a.example' },
    });
    const response = Cors.preflightResponse(request, ['https://a.example']);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://a.example');
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('returns a bare 204 when the origin is not on the allow list', () => {
    const request = new Request('https://host/media/a.gif', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    });
    const response = Cors.preflightResponse(request, ['https://a.example']);
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('Cors.withCorsHeaders', () => {
  it('tags the response with * for a wildcard allow list', () => {
    const request = new Request('https://host/media/a.gif', {
      headers: { origin: 'https://any.example' },
    });
    const response = new Response('body', { status: 200 });
    const tagged = Cors.withCorsHeaders(response, request, ['*']);
    expect(tagged.headers.get('access-control-allow-origin')).toBe('*');
    expect(tagged.headers.get('vary')).toBeNull();
  });

  it('echoes the Origin for an exact match', () => {
    const request = new Request('https://host/media/a.gif', {
      headers: { origin: 'https://a.example' },
    });
    const response = new Response('body', { status: 200 });
    const tagged = Cors.withCorsHeaders(response, request, ['https://a.example']);
    expect(tagged.headers.get('access-control-allow-origin')).toBe('https://a.example');
    expect(tagged.headers.get('vary')).toBe('Origin');
  });

  it('leaves the response alone when the Origin is not allowed', () => {
    const request = new Request('https://host/media/a.gif', {
      headers: { origin: 'https://evil.example' },
    });
    const response = new Response('body', { status: 200 });
    const tagged = Cors.withCorsHeaders(response, request, ['https://a.example']);
    expect(tagged.headers.get('access-control-allow-origin')).toBeNull();
  });
});
