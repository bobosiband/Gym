import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';

import { Cors } from '../../services/auth/src/http/Cors.js';

function buildEvent(origin: string | undefined, method: string = 'POST'): APIGatewayProxyEventV2 {
  const headers: Record<string, string> = {};
  if (origin !== undefined) headers['origin'] = origin;
  return {
    version: '2.0',
    routeKey: `${method} /test`,
    rawPath: '/test',
    rawQueryString: '',
    headers,
    requestContext: {
      accountId: '0',
      apiId: 'a',
      domainName: 'd',
      domainPrefix: 'd',
      http: { method, path: '/test', protocol: 'HTTP/1.1', sourceIp: '0.0.0.0', userAgent: 'u' },
      requestId: 'r',
      routeKey: `${method} /test`,
      stage: '$default',
      time: '',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe('Cors', () => {
  it('parses the allow-list', () => {
    expect(Cors.parseAllowedOrigins('https://a,  https://b  ,')).toEqual([
      'https://a',
      'https://b',
    ]);
  });

  it('echoes an allowed origin on preflight', () => {
    const event = buildEvent('https://a', 'OPTIONS');
    const response = Cors.preflightResponse(event, ['https://a']);
    expect(response.statusCode).toBe(204);
    expect(response.headers?.['access-control-allow-origin']).toBe('https://a');
    expect(response.headers?.['access-control-allow-methods']).toContain('POST');
  });

  it('drops CORS headers on preflight for a disallowed origin', () => {
    const event = buildEvent('https://evil', 'OPTIONS');
    const response = Cors.preflightResponse(event, ['https://a']);
    expect(response.statusCode).toBe(204);
    expect(response.headers?.['access-control-allow-origin']).toBeUndefined();
  });

  it('adds CORS headers on non-preflight responses when origin is allowed', () => {
    const event = buildEvent('https://a');
    const decorated = Cors.withCorsHeaders(
      { statusCode: 200, headers: { 'content-type': 'application/json' }, body: '{}' },
      event,
      ['https://a']
    );
    expect(decorated.headers?.['access-control-allow-origin']).toBe('https://a');
    expect(decorated.headers?.['vary']).toBe('Origin');
  });

  it('does not add CORS headers for a disallowed origin', () => {
    const event = buildEvent('https://evil');
    const decorated = Cors.withCorsHeaders(
      { statusCode: 200, headers: { 'content-type': 'application/json' }, body: '{}' },
      event,
      ['https://a']
    );
    expect(decorated.headers?.['access-control-allow-origin']).toBeUndefined();
  });
});
