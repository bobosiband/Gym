/**
 * Validator for the `APP_PUBLIC_URL` config value.
 *
 * `APP_PUBLIC_URL` is the absolute https origin of the deployed web
 * app and is used as the base for email verification and password
 * reset links. It is deliberately separate from `APP_ORIGINS` (which
 * drives CORS and legitimately carries `*` under the 2026-10-29
 * wildcard policy): a wildcard is never a valid link base. Validation
 * runs at CDK synth time so a misconfigured value fails the deploy
 * before any Lambda is updated.
 */
export class AppPublicUrl {
  /**
   * Validate and normalise a raw `APP_PUBLIC_URL` value.
   *
   * Accepts an absolute https URL with no trailing slash. Trims
   * surrounding whitespace; otherwise the returned value is identical
   * to the input so the configured URL and the URL used to build email
   * links stay byte-identical.
   *
   * @param raw The raw value, typically `process.env['APP_PUBLIC_URL']`.
   * @returns The normalised value suitable for link construction.
   * @throws {Error} When the value is missing, empty, `'*'`, not a
   *   parseable URL, does not use the `https:` protocol, or ends with
   *   a slash. The message is actionable and names both the offending
   *   value and where to fix it.
   */
  public static resolve(raw: string | undefined): string {
    if (raw === undefined) {
      throw new Error(
        "APP_PUBLIC_URL must be set to the deployed web app's absolute https URL " +
          "(for example 'https://gym-phi-blush-16.vercel.app') in services/auth/.env. " +
          "'*' is only valid for ALLOWED_ORIGINS (CORS), not for email link construction."
      );
    }
    const value = raw.trim();
    if (value.length === 0) {
      throw new Error('APP_PUBLIC_URL is empty. Set it in services/auth/.env.');
    }
    if (value === '*') {
      throw new Error(
        "APP_PUBLIC_URL cannot be '*'. The wildcard is only valid for ALLOWED_ORIGINS; " +
          'APP_PUBLIC_URL must be a concrete absolute https URL (for example ' +
          "'https://gym-phi-blush-16.vercel.app')."
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(
        `APP_PUBLIC_URL must be an absolute URL, got '${value}'. Set it in services/auth/.env.`
      );
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(
        `APP_PUBLIC_URL must use https, got protocol '${parsed.protocol}' for value '${value}'.`
      );
    }
    if (value.endsWith('/')) {
      throw new Error(
        `APP_PUBLIC_URL must not end with a trailing slash, got '${value}'. ` +
          'Remove the trailing slash so email link construction has exactly one joiner.'
      );
    }
    return value;
  }
}
