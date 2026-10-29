import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';

import { MeHandler } from '../../services/auth/src/handlers/MeHandler.js';

import { FakeMailer } from './support/FakeMailer.js';
import { buildAuthService } from './support/buildAuthService.js';

function eventWithSub(sub: string | undefined): APIGatewayProxyEventV2 {
  const authorizer: Record<string, unknown> = {};
  if (sub !== undefined) {
    authorizer['jwt'] = { claims: { sub } };
  }
  return {
    version: '2.0',
    routeKey: 'GET /auth/me',
    rawPath: '/auth/me',
    rawQueryString: '',
    headers: {},
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
      authorizer: authorizer as never,
    },
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe('MeHandler', () => {
  it('returns the user for a valid subject claim', async () => {
    const h = buildAuthService();
    await h.service.register('alice@example.com', 'correct horse battery staple');
    const mail = h.mailer.lastMailFor('alice@example.com')!;
    const token = FakeMailer.extractTokenFromBody(mail.text) as string;
    await h.service.verifyEmail(token);
    const user = (await h.users.getUserByEmail('alice@example.com'))!;

    const handler = new MeHandler(h.service);
    const response = await handler.handle(eventWithSub(user.id));
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body as string);
    expect(body.user.email).toBe('alice@example.com');
    expect(body.user.emailVerified).toBe(true);
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('returns UNAUTHORIZED when the subject claim is missing', async () => {
    const h = buildAuthService();
    const response = await new MeHandler(h.service).handle(eventWithSub(undefined));
    expect(response.statusCode).toBe(401);
  });

  it('returns UNAUTHORIZED when the subject is unknown', async () => {
    const h = buildAuthService();
    const response = await new MeHandler(h.service).handle(eventWithSub('ghost'));
    expect(response.statusCode).toBe(401);
  });
});
