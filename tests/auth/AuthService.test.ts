import { describe, expect, it } from 'vitest';

import { USER_REGISTERED_V1_DETAIL_TYPE } from '../../packages/contracts/src/events/userRegistered.v1.js';

import { AuthPolicy } from '../../services/auth/src/service/AuthService.js';
import { AuthServiceError } from '../../services/auth/src/service/AuthServiceErrors.js';

import { FakeMailer } from './support/FakeMailer.js';
import { buildAuthService } from './support/buildAuthService.js';

const VALID_PASSWORD = 'correct horse battery staple';
const EMAIL = 'alice@example.com';

async function registerAndVerify(h: ReturnType<typeof buildAuthService>): Promise<void> {
  await h.service.register(EMAIL, VALID_PASSWORD);
  const mail = h.mailer.lastMailFor(EMAIL);
  if (mail === undefined) throw new Error('verification email missing');
  const token = FakeMailer.extractTokenFromBody(mail.text);
  if (token === null) throw new Error('token missing in body');
  await h.service.verifyEmail(token);
}

describe('AuthService.register', () => {
  it('creates a verified-pending user and sends a verification email', async () => {
    const h = buildAuthService();
    await h.service.register(EMAIL, VALID_PASSWORD);
    const user = await h.users.getUserByEmail(EMAIL);
    expect(user).not.toBeNull();
    expect(user!.emailVerified).toBe(false);
    expect(h.mailer.sent.length).toBe(1);
    expect(h.mailer.sent[0]!.to).toBe(EMAIL);
    expect(h.mailer.sent[0]!.subject).toContain('Verify');
  });

  it('normalises the email to lowercase + trimmed', async () => {
    const h = buildAuthService();
    await h.service.register('  ALICE@Example.com  ', VALID_PASSWORD);
    const user = await h.users.getUserByEmail(EMAIL);
    expect(user).not.toBeNull();
    expect(user!.email).toBe(EMAIL);
  });

  it('publishes user.registered.v1', async () => {
    const h = buildAuthService();
    await h.service.register(EMAIL, VALID_PASSWORD);
    expect(h.events.events.length).toBe(1);
    expect(h.events.events[0]!.detailType).toBe(USER_REGISTERED_V1_DETAIL_TYPE);
    const detail = h.events.events[0]!.detail as { userId: string; eventId: string };
    expect(detail.userId).toBeDefined();
    expect(detail.eventId).toBeDefined();
    expect(detail.userId).not.toBe(detail.eventId);
  });

  it('rejects a weak password', async () => {
    const h = buildAuthService();
    await expect(h.service.register(EMAIL, 'short')).rejects.toBeInstanceOf(AuthServiceError);
    expect(h.mailer.sent.length).toBe(0);
    expect(h.events.events.length).toBe(0);
  });

  it('re-sends verification for an existing unverified account, no new user and no event', async () => {
    const h = buildAuthService();
    await h.service.register(EMAIL, VALID_PASSWORD);
    await h.service.register(EMAIL, VALID_PASSWORD);
    expect(h.mailer.sent.length).toBe(2);
    expect(h.events.events.length).toBe(1);
  });

  it('is a no-op for an already verified account (no email, no event)', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    h.mailer.sent.length = 0;
    h.events.events.length = 0;
    await h.service.register(EMAIL, VALID_PASSWORD);
    expect(h.mailer.sent.length).toBe(0);
    expect(h.events.events.length).toBe(0);
  });
});

describe('AuthService.verifyEmail', () => {
  it('marks the user as verified', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    const user = await h.users.getUserByEmail(EMAIL);
    expect(user!.emailVerified).toBe(true);
  });

  it('rejects an unknown token', async () => {
    const h = buildAuthService();
    await expect(h.service.verifyEmail('nope')).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('rejects a reused verification token', async () => {
    const h = buildAuthService();
    await h.service.register(EMAIL, VALID_PASSWORD);
    const token = FakeMailer.extractTokenFromBody(h.mailer.sent[0]!.text) as string;
    await h.service.verifyEmail(token);
    await expect(h.service.verifyEmail(token)).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('rejects an expired verification token', async () => {
    const h = buildAuthService();
    await h.service.register(EMAIL, VALID_PASSWORD);
    const token = FakeMailer.extractTokenFromBody(h.mailer.sent[0]!.text) as string;
    h.clock.advanceSeconds(AuthPolicy.VERIFY_TOKEN_SECONDS + 1);
    await expect(h.service.verifyEmail(token)).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
  });
});

describe('AuthService.resendVerification', () => {
  it('resends to a known unverified account', async () => {
    const h = buildAuthService();
    await h.service.register(EMAIL, VALID_PASSWORD);
    h.mailer.sent.length = 0;
    await h.service.resendVerification(EMAIL);
    expect(h.mailer.sent.length).toBe(1);
  });

  it('is silent for an unknown account (no email, no error)', async () => {
    const h = buildAuthService();
    await h.service.resendVerification('ghost@example.com');
    expect(h.mailer.sent.length).toBe(0);
  });

  it('is silent for an already verified account', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    h.mailer.sent.length = 0;
    await h.service.resendVerification(EMAIL);
    expect(h.mailer.sent.length).toBe(0);
  });

  it('enforces the email rate limit', async () => {
    const h = buildAuthService();
    await h.service.register(EMAIL, VALID_PASSWORD);
    await h.service.resendVerification(EMAIL);
    await h.service.resendVerification(EMAIL);
    await expect(h.service.resendVerification(EMAIL)).rejects.toMatchObject({
      code: 'EMAIL_RATE_LIMITED',
    });
  });
});

describe('AuthService.login', () => {
  it('issues an access + refresh pair for valid credentials', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    const tokens = await h.service.login(EMAIL, VALID_PASSWORD);
    expect(tokens.accessToken).toContain('access#');
    expect(tokens.refreshToken.length).toBeGreaterThan(32);
    expect(tokens.expiresInSeconds).toBe(AuthPolicy.ACCESS_TOKEN_SECONDS);
  });

  it('rejects an unknown email with the generic error (no distinct code)', async () => {
    const h = buildAuthService();
    await expect(h.service.login('ghost@example.com', VALID_PASSWORD)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects an incorrect password with the generic error', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    await expect(h.service.login(EMAIL, 'wrong password 123')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects login for an unverified account', async () => {
    const h = buildAuthService();
    await h.service.register(EMAIL, VALID_PASSWORD);
    await expect(h.service.login(EMAIL, VALID_PASSWORD)).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('locks the account after 5 failed logins and refuses the 6th', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    for (let i = 0; i < 5; i += 1) {
      await expect(h.service.login(EMAIL, 'wrong password 123')).rejects.toBeDefined();
    }
    await expect(h.service.login(EMAIL, VALID_PASSWORD)).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });
  });

  it('allows login again after the lockout window elapses and credentials are correct', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    for (let i = 0; i < 5; i += 1) {
      await expect(h.service.login(EMAIL, 'wrong password 123')).rejects.toBeDefined();
    }
    h.clock.advanceSeconds(AuthPolicy.LOCKOUT_SECONDS + 1);
    const tokens = await h.service.login(EMAIL, VALID_PASSWORD);
    expect(tokens.accessToken).toBeDefined();
  });

  it('does similar work for unknown and known emails (dummy hash exercised)', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    const start = Date.now();
    await expect(h.service.login('ghost@example.com', VALID_PASSWORD)).rejects.toBeDefined();
    const unknownElapsed = Date.now() - start;
    const start2 = Date.now();
    await expect(h.service.login(EMAIL, 'wrong password 123')).rejects.toBeDefined();
    const wrongElapsed = Date.now() - start2;
    expect(unknownElapsed).toBeGreaterThan(5);
    expect(wrongElapsed).toBeGreaterThan(5);
  });
});

describe('AuthService.refresh', () => {
  it('rotates the refresh token on every call', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    const first = await h.service.login(EMAIL, VALID_PASSWORD);
    h.clock.advanceSeconds(1);
    const second = await h.service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.accessToken).not.toBe(first.accessToken);
  });

  it('revokes the whole family on refresh-token reuse', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    const first = await h.service.login(EMAIL, VALID_PASSWORD);
    const second = await h.service.refresh(first.refreshToken);
    await expect(h.service.refresh(first.refreshToken)).rejects.toMatchObject({
      code: 'TOKEN_ALREADY_USED',
    });
    await expect(h.service.refresh(second.refreshToken)).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('rejects an unknown refresh token', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    await expect(h.service.refresh('nope')).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('rejects an expired refresh token', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    const tokens = await h.service.login(EMAIL, VALID_PASSWORD);
    h.clock.advanceSeconds(AuthPolicy.REFRESH_TOKEN_SECONDS + 1);
    await expect(h.service.refresh(tokens.refreshToken)).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    });
  });
});

describe('AuthService.logout', () => {
  it('revokes the presented refresh token', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    const tokens = await h.service.login(EMAIL, VALID_PASSWORD);
    await h.service.logout(tokens.refreshToken);
    await expect(h.service.refresh(tokens.refreshToken)).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('silently ignores an unknown token', async () => {
    const h = buildAuthService();
    await h.service.logout('nope');
  });
});

describe('AuthService.forgotPassword / resetPassword', () => {
  it('sends a reset email for a known user', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    h.mailer.sent.length = 0;
    await h.service.forgotPassword(EMAIL);
    expect(h.mailer.sent.length).toBe(1);
    expect(h.mailer.sent[0]!.subject).toContain('Reset');
  });

  it('is silent for an unknown email (no error, no mail)', async () => {
    const h = buildAuthService();
    await h.service.forgotPassword('ghost@example.com');
    expect(h.mailer.sent.length).toBe(0);
  });

  it('consumes the reset token and sets a new password', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    await h.service.forgotPassword(EMAIL);
    const token = FakeMailer.extractTokenFromBody(h.mailer.sent.at(-1)!.text) as string;
    await h.service.resetPassword(token, 'brand new password 123');
    const tokens = await h.service.login(EMAIL, 'brand new password 123');
    expect(tokens.accessToken).toBeDefined();
  });

  it('cannot reuse a reset token', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    await h.service.forgotPassword(EMAIL);
    const token = FakeMailer.extractTokenFromBody(h.mailer.sent.at(-1)!.text) as string;
    await h.service.resetPassword(token, 'brand new password 123');
    await expect(h.service.resetPassword(token, 'another new password 456')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('rejects an expired reset token (30 minutes)', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    await h.service.forgotPassword(EMAIL);
    const token = FakeMailer.extractTokenFromBody(h.mailer.sent.at(-1)!.text) as string;
    h.clock.advanceSeconds(AuthPolicy.RESET_TOKEN_SECONDS + 1);
    await expect(h.service.resetPassword(token, 'brand new password 123')).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    });
  });

  it('revokes all active refresh tokens after a reset', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    const session1 = await h.service.login(EMAIL, VALID_PASSWORD);
    const session2 = await h.service.login(EMAIL, VALID_PASSWORD);
    await h.service.forgotPassword(EMAIL);
    const token = FakeMailer.extractTokenFromBody(h.mailer.sent.at(-1)!.text) as string;
    await h.service.resetPassword(token, 'brand new password 123');
    await expect(h.service.refresh(session1.refreshToken)).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
    await expect(h.service.refresh(session2.refreshToken)).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('rejects a reset-password request with a weak new password', async () => {
    const h = buildAuthService();
    await registerAndVerify(h);
    await h.service.forgotPassword(EMAIL);
    const token = FakeMailer.extractTokenFromBody(h.mailer.sent.at(-1)!.text) as string;
    await expect(h.service.resetPassword(token, 'short')).rejects.toMatchObject({
      code: 'WEAK_PASSWORD',
    });
  });
});
