/**
 * Structured logger used by every Lambda handler. Output lines are
 * JSON so CloudWatch can index them without a parsing stage.
 *
 * The logger deliberately omits any method that accepts arbitrary
 * objects: callers pass a `fields` record whose values must be
 * primitives or short strings. Secret values (tokens, passwords,
 * hashes, SMTP credentials, AWS credentials) must never be passed in
 * via `fields`; the review checklist in `services/auth/README.md`
 * repeats this rule.
 */
export class Logger {
  public constructor(
    private readonly service: string,
    private readonly requestId: string
  ) {}

  /**
   * Emit an info-level log line.
   */
  public info(
    message: string,
    fields: Readonly<Record<string, string | number | boolean>> = {}
  ): void {
    this.emit('info', message, fields);
  }

  /**
   * Emit a warn-level log line.
   */
  public warn(
    message: string,
    fields: Readonly<Record<string, string | number | boolean>> = {}
  ): void {
    this.emit('warn', message, fields);
  }

  /**
   * Emit an error-level log line. Pass `error.message` not the full
   * error so stack traces do not leak into persistent logs.
   */
  public error(
    message: string,
    fields: Readonly<Record<string, string | number | boolean>> = {}
  ): void {
    this.emit('error', message, fields);
  }

  private emit(
    level: 'info' | 'warn' | 'error',
    message: string,
    fields: Readonly<Record<string, string | number | boolean>>
  ): void {
    const line = {
      level,
      service: this.service,
      requestId: this.requestId,
      message,
      ...fields,
    };
    const serialised = JSON.stringify(line);
    if (level === 'error') {
      console.error(serialised);
    } else if (level === 'warn') {
      console.warn(serialised);
    } else {
      console.log(serialised);
    }
  }
}
