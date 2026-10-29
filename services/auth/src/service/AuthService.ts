import {
  USER_REGISTERED_V1_DETAIL_TYPE,
  type UserRegisteredV1,
} from '@gym/contracts/events/userRegistered.v1.js';

import type { EventPublisher } from '../events/EventPublisher.js';
import type { Mailer } from '../mail/Mailer.js';
import { EmailTemplates } from '../mail/EmailTemplates.js';
import type { PasswordHasher } from '../passwords/PasswordHasher.js';
import { PasswordPolicy } from '../passwords/PasswordPolicy.js';
import type { EmailRateLimiter } from '../rateLimit/EmailRateLimiter.js';
import type { SessionRecord } from '../sessions/Session.js';
import type { SessionRepository } from '../sessions/SessionRepository.js';
import { TokenHasher } from '../sessions/TokenHasher.js';
import type { JwtSigner } from '../tokens/JwtSigner.js';
import type { User } from '../users/User.js';
import type { UserRepository } from '../users/UserRepository.js';
import type { Clock } from '../util/Clock.js';
import { EmailNormaliser } from '../util/EmailNormaliser.js';
import type { IdGenerator } from '../util/IdGenerator.js';
import { AuthServiceError } from './AuthServiceErrors.js';

/**
 * Lifetimes and policy constants for the auth service.
 */
export class AuthPolicy {
  public static readonly ACCESS_TOKEN_SECONDS = 15 * 60;
  public static readonly REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
  public static readonly VERIFY_TOKEN_SECONDS = 24 * 60 * 60;
  public static readonly RESET_TOKEN_SECONDS = 30 * 60;
  public static readonly MAX_FAILED_LOGINS = 5;
  public static readonly LOCKOUT_SECONDS = 15 * 60;
  /**
   * Static encoded argon2id hash used in constant-time dummy work on
   * failed look-ups. Any valid argon2id encoding works; the value here
   * was produced once by hashing an empty string with the
   * `Argon2PasswordHasher` defaults and is never a real user password.
   */
  public static readonly DUMMY_PASSWORD_HASH =
    '$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXlzYWx0ZHVtbXlzYWx0ZHVtbXk$Ff5PxVYY1y7MxBAoJz3C94X7swTYlNbPfRYNRGhRJIk';

  private constructor() {
    // policy class; never instantiated
  }
}

/**
 * Token pair returned by login and refresh. `expiresInSeconds` applies
 * to the access token.
 */
export interface IssuedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresInSeconds: number;
}

/**
 * Dependencies injected into `AuthService`. Keeping them in a single
 * record keeps the constructor readable and makes test setup
 * mechanical.
 */
export interface AuthServiceDeps {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly passwordHasher: PasswordHasher;
  readonly jwtSigner: JwtSigner;
  readonly mailer: Mailer;
  readonly events: EventPublisher;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly emailLimiter: EmailRateLimiter;
  readonly issuer: string;
  readonly audience: string;
  readonly verifyUrlBase: string;
  readonly resetUrlBase: string;
}

/**
 * Orchestrates sign-up, login, token issuance, and account recovery.
 *
 * Every method takes already-normalised inputs: callers (the Lambda
 * handlers) are responsible for shape validation (via `BodyParser`)
 * and for lower-casing the email. The service is responsible for the
 * generic responses, lockout, rotation reuse detection, and the ban
 * on logging secrets.
 */
export class AuthService {
  public constructor(private readonly deps: AuthServiceDeps) {}

  /**
   * Register a new user and queue a verification email. Returns
   * normally whether or not an account already exists for the email,
   * so the caller can respond identically in both cases. Publishes
   * `user.registered.v1` only when a new user record is actually
   * created.
   */
  public async register(rawEmail: string, password: string): Promise<void> {
    this.ensurePasswordAcceptable(password);
    const email = EmailNormaliser.normalise(rawEmail);
    const existing = await this.deps.users.getUserByEmail(email);

    if (existing !== null) {
      if (!existing.emailVerified) {
        await this.sendVerificationEmail(existing.id, email);
      }
      return;
    }

    const now = this.deps.clock.now();
    const user: User = {
      id: this.deps.ids.nextId(),
      email,
      passwordHash: await this.deps.passwordHasher.hash(password),
      emailVerified: false,
      createdAt: now.toISOString(),
      failedLoginCount: 0,
    };
    await this.deps.users.createUser(user);

    const detail: UserRegisteredV1 = {
      eventId: this.deps.ids.nextId(),
      userId: user.id,
      registeredAt: user.createdAt,
    };
    await this.deps.events.publish(USER_REGISTERED_V1_DETAIL_TYPE, detail);

    await this.sendVerificationEmail(user.id, email);
  }

  /**
   * Consume a verification token. Marks the user as verified on
   * success; raises `INVALID_TOKEN` or `TOKEN_EXPIRED` on failure.
   */
  public async verifyEmail(rawToken: string): Promise<void> {
    const record = await this.loadSingleUseToken(rawToken, 'verify');
    await this.deps.users.markEmailVerified(record.userId);
    await this.deps.sessions.markUsed(record.tokenHashId, this.deps.clock.now().toISOString());
  }

  /**
   * Queue a fresh verification email. Deliberately generic for both
   * "no such user" and "already verified".
   */
  public async resendVerification(rawEmail: string): Promise<void> {
    const email = EmailNormaliser.normalise(rawEmail);
    const user = await this.deps.users.getUserByEmail(email);
    if (user === null || user.emailVerified) return;
    await this.sendVerificationEmail(user.id, email);
  }

  /**
   * Verify credentials and issue a token pair. Throws on any failure
   * so the handler can respond with the generic UNAUTHORIZED body.
   */
  public async login(rawEmail: string, password: string): Promise<IssuedTokens> {
    const email = EmailNormaliser.normalise(rawEmail);
    const user = await this.deps.users.getUserByEmail(email);
    if (user === null) {
      await this.deps.passwordHasher.verify(AuthPolicy.DUMMY_PASSWORD_HASH, password);
      throw new AuthServiceError('INVALID_CREDENTIALS');
    }

    if (user.lockedUntil !== undefined && user.lockedUntil > this.deps.clock.now().toISOString()) {
      await this.deps.passwordHasher.verify(AuthPolicy.DUMMY_PASSWORD_HASH, password);
      throw new AuthServiceError('ACCOUNT_LOCKED');
    }

    const ok = await this.deps.passwordHasher.verify(user.passwordHash, password);
    if (!ok) {
      const next = user.failedLoginCount + 1;
      const lockUntil =
        next >= AuthPolicy.MAX_FAILED_LOGINS
          ? new Date(this.deps.clock.nowMillis() + AuthPolicy.LOCKOUT_SECONDS * 1000).toISOString()
          : undefined;
      if (lockUntil === undefined) {
        await this.deps.users.recordFailedLogin(user.id);
      } else {
        await this.deps.users.recordFailedLogin(user.id, lockUntil);
      }
      throw new AuthServiceError('INVALID_CREDENTIALS');
    }

    if (!user.emailVerified) {
      throw new AuthServiceError('EMAIL_NOT_VERIFIED');
    }

    await this.deps.users.resetFailedLogins(user.id);
    return this.issueTokenPair(user.id, this.deps.ids.nextId());
  }

  /**
   * Rotate a refresh token. If the presented token has already been
   * used, revoke the whole family and refuse the request.
   */
  public async refresh(rawToken: string): Promise<IssuedTokens> {
    const hashId = TokenHasher.hashToken(rawToken);
    const record = await this.deps.sessions.getByHashId(hashId);
    if (record === null || record.kind !== 'refresh') {
      throw new AuthServiceError('INVALID_TOKEN');
    }
    if (record.revokedAt !== undefined) {
      throw new AuthServiceError('INVALID_TOKEN');
    }
    if (record.expiresAt <= this.deps.clock.nowSeconds()) {
      throw new AuthServiceError('TOKEN_EXPIRED');
    }
    if (record.usedAt !== undefined) {
      const familyId = record.familyId;
      if (familyId !== undefined) {
        await this.deps.sessions.revokeFamily(familyId, this.deps.clock.now().toISOString());
      }
      throw new AuthServiceError('TOKEN_ALREADY_USED');
    }

    await this.deps.sessions.markUsed(hashId, this.deps.clock.now().toISOString());
    const familyId = record.familyId ?? this.deps.ids.nextId();
    return this.issueTokenPair(record.userId, familyId);
  }

  /**
   * Revoke the refresh token that was just presented. Unknown tokens
   * are silently ignored so logout cannot be used to enumerate valid
   * tokens.
   */
  public async logout(rawToken: string): Promise<void> {
    const hashId = TokenHasher.hashToken(rawToken);
    const record = await this.deps.sessions.getByHashId(hashId);
    if (record === null || record.kind !== 'refresh') return;
    await this.deps.sessions.markRevoked(hashId, this.deps.clock.now().toISOString());
  }

  /**
   * Queue a password-reset email. Deliberately generic for "no such
   * user" and "rate limited".
   */
  public async forgotPassword(rawEmail: string): Promise<void> {
    const email = EmailNormaliser.normalise(rawEmail);
    const user = await this.deps.users.getUserByEmail(email);
    if (user === null) return;
    if (!(await this.deps.emailLimiter.isAllowed(email, 'reset'))) {
      throw new AuthServiceError('EMAIL_RATE_LIMITED');
    }
    const raw = TokenHasher.generateRawToken();
    const now = this.deps.clock.nowSeconds();
    const record: SessionRecord = {
      tokenHashId: TokenHasher.hashToken(raw),
      kind: 'reset',
      userId: user.id,
      createdAt: new Date(now * 1000).toISOString(),
      expiresAt: now + AuthPolicy.RESET_TOKEN_SECONDS,
    };
    await this.deps.sessions.create(record);
    const template = EmailTemplates.passwordReset(this.buildLink(this.deps.resetUrlBase, raw));
    await this.deps.mailer.send(email, template.subject, template.body);
    await this.deps.emailLimiter.recordSend(email, 'reset');
  }

  /**
   * Consume a reset token and set a new password. Revokes every
   * session for the user so a leaked old refresh token cannot survive
   * the reset.
   */
  public async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    this.ensurePasswordAcceptable(newPassword);
    const record = await this.loadSingleUseToken(rawToken, 'reset');
    const hash = await this.deps.passwordHasher.hash(newPassword);
    await this.deps.users.updatePasswordHash(record.userId, hash);
    const now = this.deps.clock.now().toISOString();
    await this.deps.sessions.markUsed(record.tokenHashId, now);
    await this.deps.sessions.revokeAllForUser(record.userId, now);
  }

  /** Return the user profile for the given id. */
  public async getProfile(userId: string): Promise<User | null> {
    return this.deps.users.getUserById(userId);
  }

  private async sendVerificationEmail(userId: string, email: string): Promise<void> {
    if (!(await this.deps.emailLimiter.isAllowed(email, 'verify'))) {
      throw new AuthServiceError('EMAIL_RATE_LIMITED');
    }
    const raw = TokenHasher.generateRawToken();
    const now = this.deps.clock.nowSeconds();
    const record: SessionRecord = {
      tokenHashId: TokenHasher.hashToken(raw),
      kind: 'verify',
      userId,
      createdAt: new Date(now * 1000).toISOString(),
      expiresAt: now + AuthPolicy.VERIFY_TOKEN_SECONDS,
    };
    await this.deps.sessions.create(record);
    const template = EmailTemplates.verification(this.buildLink(this.deps.verifyUrlBase, raw));
    await this.deps.mailer.send(email, template.subject, template.body);
    await this.deps.emailLimiter.recordSend(email, 'verify');
  }

  private async loadSingleUseToken(
    rawToken: string,
    expectedKind: 'verify' | 'reset'
  ): Promise<SessionRecord> {
    const hashId = TokenHasher.hashToken(rawToken);
    const record = await this.deps.sessions.getByHashId(hashId);
    if (record === null || record.kind !== expectedKind) {
      throw new AuthServiceError('INVALID_TOKEN');
    }
    if (record.revokedAt !== undefined || record.usedAt !== undefined) {
      throw new AuthServiceError('INVALID_TOKEN');
    }
    if (record.expiresAt <= this.deps.clock.nowSeconds()) {
      throw new AuthServiceError('TOKEN_EXPIRED');
    }
    return record;
  }

  private async issueTokenPair(userId: string, familyId: string): Promise<IssuedTokens> {
    const iat = this.deps.clock.nowSeconds();
    const accessExp = iat + AuthPolicy.ACCESS_TOKEN_SECONDS;
    const accessToken = await this.deps.jwtSigner.sign({
      iss: this.deps.issuer,
      aud: this.deps.audience,
      sub: userId,
      iat,
      exp: accessExp,
    });

    const raw = TokenHasher.generateRawToken();
    const record: SessionRecord = {
      tokenHashId: TokenHasher.hashToken(raw),
      kind: 'refresh',
      userId,
      familyId,
      createdAt: new Date(iat * 1000).toISOString(),
      expiresAt: iat + AuthPolicy.REFRESH_TOKEN_SECONDS,
    };
    await this.deps.sessions.create(record);
    return {
      accessToken,
      refreshToken: raw,
      expiresInSeconds: AuthPolicy.ACCESS_TOKEN_SECONDS,
    };
  }

  private ensurePasswordAcceptable(password: string): void {
    if (!PasswordPolicy.isAcceptable(password)) {
      throw new AuthServiceError('WEAK_PASSWORD');
    }
  }

  private buildLink(base: string, token: string): string {
    const joiner = base.includes('?') ? '&' : '?';
    return `${base}${joiner}token=${encodeURIComponent(token)}`;
  }
}
