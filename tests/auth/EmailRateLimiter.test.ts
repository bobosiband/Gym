import { describe, expect, it } from 'vitest';

import { EmailRateLimiter } from '../../services/auth/src/rateLimit/EmailRateLimiter.js';

import { FakeClock } from './support/FakeClock.js';
import { InMemorySessionRepository } from './support/InMemorySessionRepository.js';

describe('EmailRateLimiter', () => {
  it('allows up to 3 sends in a one-hour window', async () => {
    const sessions = new InMemorySessionRepository();
    const clock = new FakeClock();
    const limiter = new EmailRateLimiter(sessions, clock);

    for (let i = 0; i < 3; i += 1) {
      expect(await limiter.isAllowed('alice@example.com', 'verify')).toBe(true);
      await limiter.recordSend('alice@example.com', 'verify');
    }
    expect(await limiter.isAllowed('alice@example.com', 'verify')).toBe(false);
  });

  it('rolls off entries older than one hour', async () => {
    const sessions = new InMemorySessionRepository();
    const clock = new FakeClock();
    const limiter = new EmailRateLimiter(sessions, clock);

    for (let i = 0; i < 3; i += 1) await limiter.recordSend('alice@example.com', 'verify');
    expect(await limiter.isAllowed('alice@example.com', 'verify')).toBe(false);

    clock.advanceSeconds(3600 + 1);
    expect(await limiter.isAllowed('alice@example.com', 'verify')).toBe(true);
  });

  it('tracks each kind independently', async () => {
    const sessions = new InMemorySessionRepository();
    const clock = new FakeClock();
    const limiter = new EmailRateLimiter(sessions, clock);

    for (let i = 0; i < 3; i += 1) await limiter.recordSend('alice@example.com', 'verify');
    expect(await limiter.isAllowed('alice@example.com', 'verify')).toBe(false);
    expect(await limiter.isAllowed('alice@example.com', 'reset')).toBe(true);
  });

  it('tracks each email independently', async () => {
    const sessions = new InMemorySessionRepository();
    const clock = new FakeClock();
    const limiter = new EmailRateLimiter(sessions, clock);

    for (let i = 0; i < 3; i += 1) await limiter.recordSend('alice@example.com', 'verify');
    expect(await limiter.isAllowed('bob@example.com', 'verify')).toBe(true);
  });
});
