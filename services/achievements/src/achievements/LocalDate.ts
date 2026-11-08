/**
 * Local date helpers. Only enough logic to resolve a workout event's
 * loggedAt (UTC) to the user's local YYYY-MM-DD under a given IANA
 * time zone. Mirrors the progress service's helper so the active-day
 * roll-up here matches the streak maths there.
 */
export class LocalDate {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Convert an ISO UTC timestamp to the local YYYY-MM-DD in the
   * given time zone. Falls back to UTC if the zone is empty.
   */
  public static fromIsoUtc(iso: string, timeZone: string): string {
    const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
    if (Number.isNaN(date.getTime())) {
      return iso.slice(0, 10);
    }
    const zone = timeZone.length > 0 ? timeZone : 'UTC';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = LocalDate.find(parts, 'year');
    const month = LocalDate.find(parts, 'month');
    const day = LocalDate.find(parts, 'day');
    return `${year}-${month}-${day}`;
  }

  /**
   * Keep only the last `maxDays` dates, sorted ascending, no
   * duplicates. The caller owns the window size; the achievements
   * service uses 60 days so a seven-day-streak rule still has
   * enough history to look back on.
   */
  public static boundedWindow(
    existing: readonly string[],
    added: string,
    maxDays: number
  ): string[] {
    const set = new Set<string>(existing);
    set.add(added);
    const sorted = Array.from(set).sort();
    if (sorted.length <= maxDays) {
      return sorted;
    }
    return sorted.slice(sorted.length - maxDays);
  }

  private static find(parts: Intl.DateTimeFormatPart[], type: string): string {
    const part = parts.find((p) => p.type === type);
    return part === undefined ? '' : part.value;
  }
}
