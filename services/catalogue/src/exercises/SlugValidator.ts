/**
 * Validates lowercase kebab-case slugs used by `GET /exercises/:slug`.
 *
 * Stateless; use via static methods.
 */
export class SlugValidator {
  private static readonly PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  private constructor() {
    // utility class; never instantiated
  }

  /**
   * True when `slug` is a lowercase kebab-case identifier (letters, digits,
   * single hyphens between tokens, no leading or trailing hyphen).
   */
  public static isValid(slug: string): boolean {
    return SlugValidator.PATTERN.test(slug);
  }
}
