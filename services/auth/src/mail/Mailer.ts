/**
 * Email sending boundary.
 *
 * All email leaving the service passes through this interface so
 * handlers never know which SMTP provider is in use. The production
 * implementation (`NodemailerMailer`) talks to Gmail SMTP; tests
 * inject `FakeMailer` from `tests/auth/support`.
 */
export interface Mailer {
  /**
   * Send a plain-text email. `to` is a single recipient; the auth
   * service never sends to groups. The implementation must not log
   * `text` or any part of the recipient address beyond what is needed
   * for a short structured log line.
   */
  send(to: string, subject: string, text: string): Promise<void>;
}
