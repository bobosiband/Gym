import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { BodyParser } from '../../services/auth/src/http/BodyParser.js';

function buildEvent(
  body: string | undefined,
  isBase64Encoded: boolean = false
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /test',
    rawPath: '/test',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123',
      apiId: 'api',
      domainName: 'd',
      domainPrefix: 'd',
      http: {
        method: 'POST',
        path: '/test',
        protocol: 'HTTP/1.1',
        sourceIp: '0.0.0.0',
        userAgent: 't',
      },
      requestId: 'r',
      routeKey: 'POST /test',
      stage: '$default',
      time: '',
      timeEpoch: 0,
    },
    isBase64Encoded,
    ...(body === undefined ? {} : { body }),
  } as APIGatewayProxyEventV2;
}

const schema = z.object({ email: z.string().email() }).strict();

describe('BodyParser', () => {
  it('parses valid JSON matching the schema', () => {
    const event = buildEvent('{"email":"alice@example.com"}');
    const result = BodyParser.parse(event, schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ email: 'alice@example.com' });
  });

  it('rejects missing body', () => {
    const event = buildEvent(undefined);
    const result = BodyParser.parse(event, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing');
  });

  it('rejects invalid JSON', () => {
    const event = buildEvent('not json');
    const result = BodyParser.parse(event, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid');
  });

  it('rejects unknown fields (strict schema)', () => {
    const event = buildEvent('{"email":"a@b.co","sneaky":true}');
    const result = BodyParser.parse(event, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid');
  });

  it('rejects oversize bodies', () => {
    const big = `{"email":"${'a'.repeat(5000)}@b.co"}`;
    const event = buildEvent(big);
    const result = BodyParser.parse(event, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('too_large');
  });

  it('decodes base64 bodies', () => {
    const payload = Buffer.from('{"email":"a@b.co"}').toString('base64');
    const event = buildEvent(payload, true);
    const result = BodyParser.parse(event, schema);
    expect(result.ok).toBe(true);
  });
});
