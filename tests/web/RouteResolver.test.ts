import { describe, expect, it } from 'vitest';

import { RouteResolver } from '../../apps/web/src/routing/RouteResolver.js';

describe('RouteResolver', () => {
  const resolver = new RouteResolver();

  it('maps / to home', () => {
    expect(resolver.resolve('/', '').name).toBe('home');
  });

  it('maps /log-workout and /history', () => {
    expect(resolver.resolve('/log-workout', '').name).toBe('logWorkout');
    expect(resolver.resolve('/history', '').name).toBe('history');
  });

  it('resolves verify-email with and without a token', () => {
    const notice = resolver.resolve('/verify-email', '?email=x@y.z');
    expect(notice.name).toBe('verifyEmailNotice');
    expect(notice.email).toBe('x@y.z');
    const confirm = resolver.resolve('/verify-email', '?token=abc');
    expect(confirm.name).toBe('verifyEmailConfirm');
    expect(confirm.token).toBe('abc');
  });

  it('resolves reset-password with its token', () => {
    const route = resolver.resolve('/reset-password', '?token=xyz');
    expect(route.name).toBe('resetPassword');
    expect(route.token).toBe('xyz');
  });

  it('normalises trailing slashes', () => {
    expect(resolver.resolve('/login/', '').name).toBe('login');
  });

  it('falls back to notFound for unknown paths', () => {
    expect(resolver.resolve('/anything-else', '').name).toBe('notFound');
  });
});
