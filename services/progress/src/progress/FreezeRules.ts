/**
 * Rules for granting streak freezes.
 *
 * The architecture doc caps the per-user freeze balance at
 * {@link FreezeRules.MAX_FREEZES}. Freezes are earned from quest
 * completions in a later service; for Stage 3 the only grant path is
 * an internal method on `ProgressService.grantFreezes`, which the
 * quest service will call once it exists.
 */
export class FreezeRules {
  public static readonly MAX_FREEZES = 2;

  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Return the new freeze balance after granting `requested` freezes
   * to a user whose current balance is `current`. The result never
   * exceeds {@link FreezeRules.MAX_FREEZES}; any requested freeze
   * above the cap is silently dropped.
   */
  public static grant(current: number, requested: number): number {
    const sum = current + Math.max(0, requested);
    return Math.min(FreezeRules.MAX_FREEZES, sum);
  }
}
