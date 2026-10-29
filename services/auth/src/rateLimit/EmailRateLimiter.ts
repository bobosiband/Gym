import type { SessionArtefactKind } from '../sessions/Session.js';
import type { SessionRepository } from '../sessions/SessionRepository.js';
import type { Clock } from '../util/Clock.js';

/**
 * Caps verification and reset emails per address per hour.
 *
 * The limit (`MAX_PER_HOUR`) is enforced per `(email, kind)` pair,
 * which protects both the Gmail daily SMTP cap and the user's inbox
 * from an attacker pointing the service at a random address. Rows
 * live in the sessions table (so Dynamo TTL takes care of expiry) and
 * are inserted with `recordSend` only after the mailer has returned
 * success. Enforcement is check-then-record; the window is short and
 * requests are low volume, so a two-request race giving a user four
 * emails in an hour is tolerated.
 */
export class EmailRateLimiter {
  public static readonly MAX_PER_HOUR = 3;
  private static readonly WINDOW_SECONDS = 3600;

  public constructor(
    private readonly sessions: SessionRepository,
    private readonly clock: Clock
  ) {}

  /** `true` iff the email is still allowed in the current window. */
  public async isAllowed(email: string, kind: SessionArtefactKind): Promise<boolean> {
    const since = this.clock.nowSeconds() - EmailRateLimiter.WINDOW_SECONDS;
    const count = await this.sessions.countRecentForEmail(email, kind, since);
    return count < EmailRateLimiter.MAX_PER_HOUR;
  }

  /** Record that an email was sent so future calls count towards the cap. */
  public async recordSend(email: string, kind: SessionArtefactKind): Promise<void> {
    await this.sessions.recordEmailSend(email, kind, this.clock.nowSeconds());
  }
}
