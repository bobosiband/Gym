/**
 * Normalises email addresses so look-ups and unique indexes behave the
 * same regardless of how the user typed their address. Trimming and
 * lower-casing are the only transformations applied; local-part dot
 * folding and plus-tag stripping are intentionally not performed since
 * those rules are provider specific.
 */
export class EmailNormaliser {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Trim surrounding whitespace and lower-case the whole address.
   * Returns the original input unchanged if it is not a string so the
   * caller can decide how to reject malformed input.
   */
  public static normalise(raw: string): string {
    return raw.trim().toLowerCase();
  }
}
