import { Exercise, type SummaryContribution, type XpRule } from '@gym/exercise-core';

import { PushupSummaryContribution } from './PushupSummaryContribution.js';
import { PushupXpRule } from './PushupXpRule.js';

/**
 * Push-up exercise strategy.
 *
 * Owns the per-event XP rule and the daily-summary contribution. The
 * rep detector lives alongside this class and is created on demand
 * by UI callers via `new PushupRepDetector(...)`; it is not attached
 * to the Exercise instance so server code never pulls in the pose
 * package.
 */
export class PushupExercise extends Exercise {
  public override readonly id: string = 'pushup';
  public override readonly displayName: string = 'Push-ups';
  public override readonly xpRule: XpRule = new PushupXpRule();
  public override readonly summaryContribution: SummaryContribution =
    new PushupSummaryContribution();
}
