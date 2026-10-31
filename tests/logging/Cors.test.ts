import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';

import { Cors } from '../../services/logging/src/http/Cors.js';

function event(origin: string | undefined): APIGatewayProxyEventV2 {
  return {
    headers: origin === undefined ? {} : { origin },
    rawPath: '/',
    rawQueryString: '',
    routeKey: 'POST /',
    version: '2.0',
    isBase64Encoded: false,
    requestContext: {
      requestId: 'req',
      http: { method: 'POST', path: '/', protocol: 'HTTP/1.1', sourceIp: '0.0.0.0', userAgent: '' },
    },
  } as unknown as APIGatewayProxyEventV2;
}

describe('Cors', () => {
  it('wildcard mode echoes * without vary', () => {
    const response = Cors.preflightResponse(event('https://app.example'), ['*']);
    expect(response.headers?.['access-control-allow-origin']).toBe('*');
    expect(response.headers?.['vary']).toBeUndefined();
  });

  it('named mode echoes an exact match with vary', () => {
    const response = Cors.preflightResponse(event('https://app.example'), ['https://app.example']);
    expect(response.headers?.['access-control-allow-origin']).toBe('https://app.example');
    expect(response.headers?.['vary']).toBe('Origin');
  });

  it('named mode omits CORS headers for a non-matching origin', () => {
    const response = Cors.preflightResponse(event('https://evil.example'), ['https://app.example']);
    expect(response.headers?.['access-control-allow-origin']).toBeUndefined();
  });

  it('withCorsHeaders merges on an existing response', () => {
    const original = { statusCode: 200, headers: { 'x-custom': '1' } };
    const merged = Cors.withCorsHeaders(original, event('https://app.example'), [
      'https://app.example',
    ]);
    expect(merged.headers?.['x-custom']).toBe('1');
    expect(merged.headers?.['access-control-allow-origin']).toBe('https://app.example');
  });

  it('parseAllowedOrigins handles a single wildcard', () => {
    expect(Cors.parseAllowedOrigins('*')).toEqual(['*']);
  });

  it('parseAllowedOrigins trims and drops empties', () => {
    expect(Cors.parseAllowedOrigins('https://a, ,https://b ')).toEqual(['https://a', 'https://b']);
  });
});
