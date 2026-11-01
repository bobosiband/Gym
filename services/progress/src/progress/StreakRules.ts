import { LocalDate } from '../util/LocalDate.js';

/**
 * Streak-update outcome. The streak itself and the freeze balance
 * are the two fields the caller must persist. The service also uses
 * the discriminator to decide whether to emit `streak.frozen.v1` or
 * `streak.broken.v1`.
 */
export interface StreakOutcome {
  readonly streakDays: number;
  readonly freezeBalance: number;
  readonly kind: 'advanced' | 'held' | 'started' | 'frozen' | 'broken';
  readonly previousStreakDays: number;
  readonly missedDays: number;
}

/**
 * Pure function covering every Duolingo-style streak transition.
 *
 * The function is called whenever the user has an "active day" (a
 * day where either the push-up target was hit or at least one set
 * was logged). The caller supplies the stored streak state and the
 * local date of the activity.
 *
 * Transitions:
 *
 *  - `started`: `lastActiveLocalDate` is `null`; streak jumps to 1.
 *  - `held`: today equals `lastActiveLocalDate`; nothing changes.
 *  - `advanced`: today is one calendar day after
 *    `lastActiveLocalDate`; streak increments by 1.
 *  - `frozen`: today is more than one day after
 *    `lastActiveLocalDate`, every missed day could be covered by a
 *    stored freeze, and there were enough freezes to cover them. The
 *    freeze balance decreases by the number of missed days and the
 *    streak advances by `missedDays + 1`.
 *  - `broken`: today is more than one day after
 *    `lastActiveLocalDate` and the freeze balance is insufficient.
 *    Streak resets to 1.
 */
export class StreakRules {
  private constructor() {
    // utility class; never instantiated
  }

  public static onActiveDay(input: {
    todayLocalDate: string;
    lastActiveLocalDate: string | null;
    streakDays: number;
    freezeBalance: number;
  }): StreakOutcome {
    const { todayLocalDate, lastActiveLocalDate, streakDays, freezeBalance } = input;
    if (lastActiveLocalDate === null) {
      return {
        streakDays: 1,
        freezeBalance,
        kind: 'started',
        previousStreakDays: streakDays,
        missedDays: 0,
      };
    }
    const delta = LocalDate.dayDelta(lastActiveLocalDate, todayLocalDate);
    if (delta <= 0) {
      return {
        streakDays,
        freezeBalance,
        kind: 'held',
        previousStreakDays: streakDays,
        missedDays: 0,
      };
    }
    if (delta === 1) {
      return {
        streakDays: streakDays + 1,
        freezeBalance,
        kind: 'advanced',
        previousStreakDays: streakDays,
        missedDays: 0,
      };
    }
    const missedDays = delta - 1;
    if (freezeBalance >= missedDays) {
      return {
        streakDays: streakDays + delta,
        freezeBalance: freezeBalance - missedDays,
        kind: 'frozen',
        previousStreakDays: streakDays,
        missedDays,
      };
    }
    return {
      streakDays: 1,
      freezeBalance,
      kind: 'broken',
      previousStreakDays: streakDays,
      missedDays,
    };
  }

  /**
   * Collapse the stored streak against the current local date for a
   * read-time view. Returns the "effective" streak the user sees in
   * the UI: if the user has not logged today and the gap is more
   * than one day beyond their freeze budget, the effective streak
   * is zero.
   *
   * The stored streak is left unchanged on reads; it is only
   * rewritten by {@link onActiveDay}. That split keeps the write
   * path idempotent and the read path cheap.
   */
  public static effectiveStreak(input: {
    todayLocalDate: string;
    lastActiveLocalDate: string | null;
    streakDays: number;
    freezeBalance: number;
  }): number {
    const { todayLocalDate, lastActiveLocalDate, streakDays, freezeBalance } = input;
    if (lastActiveLocalDate === null) {
      return 0;
    }
    const delta = LocalDate.dayDelta(lastActiveLocalDate, todayLocalDate);
    if (delta <= 1) {
      return streakDays;
    }
    const missedDays = delta - 1;
    return freezeBalance >= missedDays ? streakDays : 0;
  }
}
