import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { BodyParser } from '../../services/logging/src/http/BodyParser.js';

function event(body: string | undefined, isBase64Encoded = false): APIGatewayProxyEventV2 {
  return {
    body: body ?? '',
    isBase64Encoded,
    headers: {},
    rawPath: '/',
    rawQueryString: '',
    routeKey: 'POST /',
    version: '2.0',
    requestContext: {
      requestId: 'req',
      http: { method: 'POST', path: '/', protocol: 'HTTP/1.1', sourceIp: '0.0.0.0', userAgent: '' },
    },
  } as unknown as APIGatewayProxyEventV2;
}

const schema = z.object({ foo: z.string() }).strict();

describe('BodyParser', () => {
  it('parses a valid JSON body', () => {
    const result = BodyParser.parse(event(JSON.stringify({ foo: 'bar' })), schema);
    expect(result).toEqual({ ok: true, value: { foo: 'bar' } });
  });

  it('rejects a body missing a required field', () => {
    const result = BodyParser.parse(event('{}'), schema);
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown field under strict mode', () => {
    const result = BodyParser.parse(event(JSON.stringify({ foo: 'a', bar: 'b' })), schema);
    expect(result.ok).toBe(false);
  });

  it('rejects a body larger than 4 KiB', () => {
    const big = JSON.stringify({ foo: 'x'.repeat(5000) });
    const result = BodyParser.parse(event(big), schema);
    expect(result).toMatchObject({ ok: false, reason: 'too_large' });
  });

  it('decodes base64 bodies', () => {
    const encoded = Buffer.from(JSON.stringify({ foo: 'bar' }), 'utf8').toString('base64');
    const result = BodyParser.parse(event(encoded, true), schema);
    expect(result).toEqual({ ok: true, value: { foo: 'bar' } });
  });

  it('reports missing body', () => {
    const result = BodyParser.parse(event(''), schema);
    expect(result).toMatchObject({ ok: false, reason: 'missing' });
  });

  it('reports invalid JSON', () => {
    const result = BodyParser.parse(event('{"foo":'), schema);
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
  });
});
