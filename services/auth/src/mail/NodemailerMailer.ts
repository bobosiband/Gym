import nodemailer, { type Transporter } from 'nodemailer';

import type { Mailer } from './Mailer.js';

/**
 * SMTP configuration bundle. Loaded from SSM at cold start by the
 * handler factory, then passed into this class so the mailer itself
 * does not know anything about SSM or environment variables.
 */
export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly pass: string;
  readonly from: string;
}

/**
 * `Mailer` backed by Nodemailer over SMTP (production: Gmail).
 *
 * The transporter is reused across invocations of the same Lambda
 * instance, which amortises the TLS handshake over multiple requests
 * and avoids re-reading SSM. Transporter construction never prints
 * secrets.
 */
export class NodemailerMailer implements Mailer {
  private readonly transporter: Transporter;
  private readonly from: string;

  public constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    this.from = config.from;
  }

  public async send(to: string, subject: string, text: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
    });
  }
}
