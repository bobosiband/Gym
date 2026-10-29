import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';

import { LoginHandler } from '../../services/auth/src/handlers/LoginHandler.js';
import { RegisterHandler } from '../../services/auth/src/handlers/RegisterHandler.js';

import { FakeMailer } from './support/FakeMailer.js';
import { buildAuthService } from './support/buildAuthService.js';

function postEvent(path: string, body: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `POST ${path}`,
    rawPath: path,
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: '0',
      apiId: 'a',
      domainName: 'd',
      domainPrefix: 'd',
      http: { method: 'POST', path, protocol: 'HTTP/1.1', sourceIp: '0.0.0.0', userAgent: 'u' },
      requestId: 'r',
      routeKey: `POST ${path}`,
      stage: '$default',
      time: '',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  } as APIGatewayProxyEventV2;
}

describe('LoginHandler', () => {
  it('returns 200 with tokens for valid credentials', async () => {
    const h = buildAuthService();
    await new RegisterHandler(h.service).handle(
      postEvent('/auth/register', {
        email: 'alice@example.com',
        password: 'correct horse battery staple',
      })
    );
    const mail = h.mailer.lastMailFor('alice@example.com')!;
    const token = FakeMailer.extractTokenFromBody(mail.text) as string;
    await h.service.verifyEmail(token);

    const response = await new LoginHandler(h.service).handle(
      postEvent('/auth/login', {
        email: 'alice@example.com',
        password: 'correct horse battery staple',
      })
    );
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body as string);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.tokenType).toBe('Bearer');
  });

  it('returns a generic 401 for an unknown email', async () => {
    const h = buildAuthService();
    const response = await new LoginHandler(h.service).handle(
      postEvent('/auth/login', { email: 'ghost@example.com', password: 'anything-that-is-long' })
    );
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body as string)).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'invalid credentials',
    });
  });

  it('returns 403 for an unverified account', async () => {
    const h = buildAuthService();
    await new RegisterHandler(h.service).handle(
      postEvent('/auth/register', {
        email: 'alice@example.com',
        password: 'correct horse battery staple',
      })
    );
    const response = await new LoginHandler(h.service).handle(
      postEvent('/auth/login', {
        email: 'alice@example.com',
        password: 'correct horse battery staple',
      })
    );
    expect(response.statusCode).toBe(403);
  });

  it('returns 400 on malformed body', async () => {
    const h = buildAuthService();
    const response = await new LoginHandler(h.service).handle(postEvent('/auth/login', 'not json'));
    expect(response.statusCode).toBe(400);
  });

  it('returns 413 on oversize body', async () => {
    const h = buildAuthService();
    const big = JSON.stringify({ email: 'a@b.co', password: 'a'.repeat(5000) });
    const response = await new LoginHandler(h.service).handle(postEvent('/auth/login', big));
    expect(response.statusCode).toBe(413);
  });

  it('returns 400 when body contains unknown fields', async () => {
    const h = buildAuthService();
    const response = await new LoginHandler(h.service).handle(
      postEvent('/auth/login', {
        email: 'alice@example.com',
        password: 'correct horse battery staple',
        sneaky: true,
      })
    );
    expect(response.statusCode).toBe(400);
  });
});
