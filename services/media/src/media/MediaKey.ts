/**
 * Validator for incoming object keys.
 *
 * The media Worker exposes every object under `/media/<key>` where
 * `<key>` is a slash-separated path inside the R2 bucket. The
 * validator rejects anything that could be used to climb out of the
 * bucket, read a dot-file, or probe for Windows device names on
 * platforms that happen to proxy requests through one.
 */
export class MediaKey {
  private static readonly ALLOWED_SEGMENT = /^[a-z0-9][a-z0-9._-]{0,127}$/;
  private static readonly MAX_LENGTH = 512;

  private constructor() {
    // utility class; never instantiated
  }

  /**
   * `true` when the key is safe to resolve against R2. Returns `false`
   * for an empty key, any segment that fails the whitelist, any
   * key containing `..`, or any key longer than
   * {@link MediaKey.MAX_LENGTH} bytes.
   */
  public static isValid(key: string): boolean {
    if (key.length === 0 || key.length > MediaKey.MAX_LENGTH) {
      return false;
    }
    if (key.startsWith('/') || key.endsWith('/')) {
      return false;
    }
    const segments = key.split('/');
    for (const segment of segments) {
      if (!MediaKey.ALLOWED_SEGMENT.test(segment)) {
        return false;
      }
      if (segment === '..' || segment === '.') {
        return false;
      }
    }
    return true;
  }

  /**
   * Parse the key out of the URL pathname. Returns `null` when the
   * path does not match `/media/<key>` or when the key fails
   * validation.
   */
  public static extract(pathname: string): string | null {
    const prefix = '/media/';
    if (!pathname.startsWith(prefix)) {
      return null;
    }
    const key = pathname.slice(prefix.length);
    return MediaKey.isValid(key) ? key : null;
  }
}
