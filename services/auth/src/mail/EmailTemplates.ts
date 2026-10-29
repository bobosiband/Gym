/**
 * Plain-text email bodies used by the auth service. Deliberately
 * minimal and tracking-free: no HTML, no images, no analytics
 * pixels, no personalised sign-off. Each template takes only the
 * action link so templates can be audited at a glance for leaks.
 */
export class EmailTemplates {
  private constructor() {
    // utility class; never instantiated
  }

  /** Verification email body. */
  public static verification(verifyLink: string): { subject: string; body: string } {
    return {
      subject: 'Verify your Gym account',
      body: [
        'Welcome to Gym.',
        '',
        'Open this link to verify your email address:',
        verifyLink,
        '',
        'The link expires in 24 hours. If you did not create an account, ignore this email.',
        '',
        'Gym',
      ].join('\n'),
    };
  }

  /** Password-reset email body. */
  public static passwordReset(resetLink: string): { subject: string; body: string } {
    return {
      subject: 'Reset your Gym password',
      body: [
        'A password reset was requested for your Gym account.',
        '',
        'Open this link to choose a new password:',
        resetLink,
        '',
        'The link expires in 30 minutes. If you did not request a reset, ignore this email.',
        '',
        'Gym',
      ].join('\n'),
    };
  }
}
