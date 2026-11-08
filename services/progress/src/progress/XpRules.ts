/**
 * Cross-exercise XP helpers shared by the progress bounded context.
 *
 * Per-event XP is delegated to each exercise's own {@link XpRule}
 * strategy (looked up by the service through its injected
 * {@link ExerciseRegistry}); this class owns only the rules that are
 * exercise-agnostic:
 *
 *  - The one-time daily-target bonus
 *    ({@link XpRules.DAILY_TARGET_BONUS_XP}).
 *  - The level curve: cumulative XP to reach level `N` is
 *    `100 * N^2`. Level 1 unlocks at 100 XP, level 2 at 400 XP,
 *    level 3 at 900 XP, and so on. Smooth enough that early levels
 *    feel attainable and late levels take sustained training.
 */
export class XpRules {
  public static readonly DAILY_TARGET_BONUS_XP = 50;

  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Compute the user's level from cumulative XP. Returns `1` for any
   * XP in `[0, 100)` so a brand new user is already at level 1,
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
