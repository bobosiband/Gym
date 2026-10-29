import type { Mailer } from '../../../services/auth/src/mail/Mailer.js';

/**
 * In-memory `Mailer` that records every send. Used by every test so
 * no real email is ever queued. Expose the sent list so tests can
 * assert on recipients and on the raw tokens embedded in the body.
 */
export class FakeMailer implements Mailer {
  public readonly sent: { to: string; subject: string; text: string }[] = [];
  public shouldFailOnce: boolean = false;

  public async send(to: string, subject: string, text: string): Promise<void> {
    if (this.shouldFailOnce) {
      this.shouldFailOnce = false;
      throw new Error('SMTP failed');
    }
    this.sent.push({ to, subject, text });
  }

  public lastMailFor(email: string): { subject: string; text: string } | undefined {
    for (let i = this.sent.length - 1; i >= 0; i -= 1) {
      const row = this.sent[i];
      if (row !== undefined && row.to === email) return { subject: row.subject, text: row.text };
    }
    return undefined;
  }

  /**
   * Extract the raw token from a verification or reset email body.
   * Returns `null` if the body does not contain a `token=` link.
   */
  public static extractTokenFromBody(text: string): string | null {
    const match = text.match(/token=([^\s]+)/);
    if (match === null || match[1] === undefined) return null;
    return decodeURIComponent(match[1]);
  }
}
