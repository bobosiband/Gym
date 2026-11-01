/**
 * Resolve an ISO 8601 UTC timestamp to a local `YYYY-MM-DD` string
 * for the given IANA time zone.
 *
 * The service uses the browser-and-Node built-in
 * `Intl.DateTimeFormat` so no third-party `tz` package is pulled in.
 * `Intl` resolves every IANA zone the Node runtime knows about
 * (ICU is bundled with every Node 20 LTS build).
 *
 * All methods are static. The private constructor keeps the class
 * from being accidentally instantiated.
 */
export class LocalDate {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Convert `isoUtc` (an ISO 8601 UTC string such as
   * `2026-10-29T12:34:56`) to a `YYYY-MM-DD` string in `timeZone`.
   *
   * @throws RangeError when `timeZone` is not a valid IANA zone.
   */
  public static fromIsoUtc(isoUtc: string, timeZone: string): string {
    const normalised = /z$|[+-]\d{2}:?\d{2}$/i.test(isoUtc) ? isoUtc : `${isoUtc}Z`;
    const instant = new Date(normalised);
    if (Number.isNaN(instant.getTime())) {
      throw new Error(`LocalDate.fromIsoUtc: invalid instant ${isoUtc}`);
    }
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(instant);
  }

  /**
   * Signed delta in whole days from `fromDate` to `toDate`.
   * Positive when `toDate` is later. Both strings must be
   * `YYYY-MM-DD`.
   */
  public static dayDelta(fromDate: string, toDate: string): number {
    const from = Date.parse(`${fromDate}T00:00:00Z`);
    const to = Date.parse(`${toDate}T00:00:00Z`);
    if (Number.isNaN(from) || Number.isNaN(to)) {
      throw new Error(`LocalDate.dayDelta: invalid dates ${fromDate} ${toDate}`);
    }
    return Math.round((to - from) / 86_400_000);
  }

  /**
   * Add `days` to `date` (a `YYYY-MM-DD` string) and return the
   * resulting `YYYY-MM-DD` string. Operates in UTC so DST shifts in
   * the user's zone cannot alter the result.
   */
  public static addDays(date: string, days: number): string {
    const base = Date.parse(`${date}T00:00:00Z`);
    if (Number.isNaN(base)) {
      throw new Error(`LocalDate.addDays: invalid date ${date}`);
    }
    const next = new Date(base + days * 86_400_000);
    const year = next.getUTCFullYear().toString().padStart(4, '0');
    const month = (next.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = next.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** `true` if the given zone can be resolved by `Intl.DateTimeFormat`. */
  public static isValidZone(zone: string): boolean {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }
}
