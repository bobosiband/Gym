import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';

import { MeHandler } from '../../services/auth/src/handlers/MeHandler.js';

import { FakeMailer } from './support/FakeMailer.js';
import { buildAuthService, ISSUER, AUDIENCE } from './support/buildAuthService.js';

function eventWithBearer(token: string | null): APIGatewayProxyEventV2 {
  const headers: Record<string, string> = {};
  if (token !== null) headers['authorization'] = `Bearer ${token}`;
  return {
    version: '2.0',
    routeKey: 'GET /auth/me',
    rawPath: '/auth/me',
    rawQueryString: '',
    headers,
    requestContext: {
      accountId: '0',
      apiId: 'a',
      domainName: 'd',
      domainPrefix: 'd',
      http: {
        method: 'GET',
        path: '/auth/me',
        protocol: 'HTTP/1.1',
        sourceIp: '0.0.0.0',
        userAgent: 'u',
      },
      requestId: 'r',
      routeKey: 'GET /auth/me',
      stage: '$default',
      time: '',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe('MeHandler', () => {
  it('returns the user for a valid bearer token', async () => {
    const h = buildAuthService();
    await h.service.register('alice@example.com', 'correct horse battery staple');
    const mail = h.mailer.lastMailFor('alice@example.com')!;
    const verifyToken = FakeMailer.extractTokenFromBody(mail.text) as string;
    await h.service.verifyEmail(verifyToken);
    const tokens = await h.service.login('alice@example.com', 'correct horse battery staple');

    const handler = new MeHandler(h.service, h.signer, ISSUER, AUDIENCE);
    const response = await handler.handle(eventWithBearer(tokens.accessToken));
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body as string);
    expect(body.user.email).toBe('alice@example.com');
    expect(body.user.emailVerified).toBe(true);
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('returns UNAUTHORIZED without an Authorization header', async () => {
    const h = buildAuthService();
    const response = await new MeHandler(h.service, h.signer, ISSUER, AUDIENCE).handle(
      eventWithBearer(null)
    );
    expect(response.statusCode).toBe(401);
  });

  it('returns UNAUTHORIZED for a malformed token', async () => {
    const h = buildAuthService();
    const response = await new MeHandler(h.service, h.signer, ISSUER, AUDIENCE).handle(
      eventWithBearer('not-a-token')
    );
    expect(response.statusCode).toBe(401);
  });

  it('returns UNAUTHORIZED when the subject is unknown', async () => {
    const h = buildAuthService();
    const forged = await h.signer.sign({
      iss: ISSUER,
      aud: AUDIENCE,
      sub: 'ghost',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const response = await new MeHandler(h.service, h.signer, ISSUER, AUDIENCE).handle(
      eventWithBearer(forged)
    );
    expect(response.statusCode).toBe(401);
  });
});
