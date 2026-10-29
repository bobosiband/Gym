import { EmailRateLimiter } from '../../../services/auth/src/rateLimit/EmailRateLimiter.js';
import {
  AuthService,
  type AuthServiceDeps,
} from '../../../services/auth/src/service/AuthService.js';
import { Argon2PasswordHasher } from '../../../services/auth/src/passwords/Argon2PasswordHasher.js';
import { CountingIdGenerator } from './CountingIdGenerator.js';
import { FakeClock } from './FakeClock.js';
import { FakeJwtSigner } from './FakeJwtSigner.js';
import { FakeMailer } from './FakeMailer.js';
import { InMemorySessionRepository } from './InMemorySessionRepository.js';
import { InMemoryUserRepository } from './InMemoryUserRepository.js';
import { RecordingEventPublisher } from './RecordingEventPublisher.js';

/**
 * Bundle of the in-memory doubles plus a wired `AuthService`. Tests
 * destructure what they need and either read state back from the
 * doubles or drive the clock to simulate time passing.
 */
export interface TestHarness {
  readonly service: AuthService;
  readonly users: InMemoryUserRepository;
  readonly sessions: InMemorySessionRepository;
  readonly mailer: FakeMailer;
  readonly events: RecordingEventPublisher;
  readonly clock: FakeClock;
  readonly ids: CountingIdGenerator;
}

/**
 * Build a fully-wired `AuthService` with in-memory doubles for every
 * dependency except the password hasher: hashing uses the real
 * argon2 implementation so the test suite also doubles as a smoke
 * test of the native binary. Each test gets a fresh harness so no
 * state leaks between cases.
 */
export function buildAuthService(): TestHarness {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const mailer = new FakeMailer();
  const events = new RecordingEventPublisher();
  const clock = new FakeClock();
  const ids = new CountingIdGenerator();
  const emailLimiter = new EmailRateLimiter(sessions, clock);
  const deps: AuthServiceDeps = {
    users,
    sessions,
    passwordHasher: new Argon2PasswordHasher(),
    jwtSigner: new FakeJwtSigner(),
    mailer,
    events,
    ids,
    clock,
    emailLimiter,
    issuer: 'https://auth.gym.test',
    audience: 'gym-api',
    verifyUrlBase: 'https://app.gym.test/verify',
    resetUrlBase: 'https://app.gym.test/reset',
  };
  return { service: new AuthService(deps), users, sessions, mailer, events, clock, ids };
}
