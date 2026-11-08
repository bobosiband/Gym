import type { BadgeRule } from './BadgeRule.js';

/**
 * Simple ordered registry of {@link BadgeRule}s. Evaluated by the
 * service after each event. Order is stable so badges unlock in a
 * predictable sequence when a single event qualifies the user for
 * several at once (rare but possible on first-ever activity).
 */
export class BadgeRegistry {
  private readonly rules: BadgeRule[] = [];

  public register(rule: BadgeRule): void {
    this.rules.push(rule);
  }

  public list(): readonly BadgeRule[] {
    return this.rules;
  }
}
