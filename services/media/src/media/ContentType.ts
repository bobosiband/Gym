/**
 * Lookup from file extension to a safe `content-type`.
 *
 * The media Worker refuses to serve any object whose key does not
 * end in one of the whitelisted extensions below. Keeping the list
 * narrow prevents an uploaded script or HTML file from being served
 * with an executable content type.
 */
export class ContentType {
  private static readonly BY_EXTENSION: Readonly<Record<string, string>> = {
    gif: 'image/gif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };

  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Return the content-type for the given key, or `null` if the
   * extension is not on the allow list.
   */
  public static forKey(key: string): string | null {
    const dot = key.lastIndexOf('.');
    if (dot === -1 || dot === key.length - 1) {
      return null;
    }
    const extension = key.slice(dot + 1).toLowerCase();
    return ContentType.BY_EXTENSION[extension] ?? null;
  }
}
