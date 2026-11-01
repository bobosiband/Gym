import type { WorkoutLoggedV1Event } from '@gym/contracts';

/**
 * Pure functions that turn workout facts into XP and levels.
 *
 * Rules (fixed for Stage 3; owner may tune later):
 *
 *  - A push-up event earns `1 XP per 10 reps` rounded down. A rep
 *    rounds up only when the user hits the daily target bonus
 *    threshold ({@link XpRules.DAILY_TARGET_BONUS_XP}).
 *  - A set-based workout (resistance training) earns a flat
 *    {@link XpRules.SET_XP} regardless of reps or weight.
 *  - Hitting the daily push-up target earns a one-time
 *    {@link XpRules.DAILY_TARGET_BONUS_XP} bonus on the day it is
 *    hit.
 *  - Levels follow a quadratic curve: cumulative XP to reach level
 *    `N` is `100 * N^2`. Level 1 unlocks at 100 XP, level 2 at
 *    400 XP, level 3 at 900 XP, and so on. The curve is smooth
 *    enough that early levels feel attainable but late levels take
 *    sustained training.
 */
export class XpRules {
  public static readonly SET_XP = 10;
  public static readonly DAILY_TARGET_BONUS_XP = 50;

  private constructor() {
    // utility class; never instantiated
  }

  /**
   * XP awarded for a single `workout.logged.v1` event (before any
   * daily-target bonus).
   */
  public static baseXpForEvent(
    event: Pick<WorkoutLoggedV1Event.WorkoutLoggedV1, 'kind' | 'reps'>
  ): number {
    if (event.kind === 'pushup') {
      return Math.floor(event.reps / 10);
    }
    if (event.kind === 'set') {
      return XpRules.SET_XP;
    }
    return 0;
  }

  /**
   * Compute the user's level from cumulative XP. Returns `1` for
   * any XP in `[0, 100)` so a brand new user is already at level 1,
   * matching the UI expectation that there is no "level 0".
   */
  public static levelForXp(xp: number): number {
    if (xp < 100) {
      return 1;
    }
    return Math.floor(Math.sqrt(xp / 100));
  }

  /** XP threshold at which the given level is reached. */
  public static xpForLevel(level: number): number {
    return level * level * 100;
  }

  /**
   * XP remaining before the given cumulative XP crosses into the
   * next level. Returns zero exactly on a boundary.
   */
  public static xpToNextLevel(xp: number): number {
    const level = XpRules.levelForXp(xp);
    const nextLevelXp = XpRules.xpForLevel(level + 1);
    return Math.max(0, nextLevelXp - xp);
  }
}
