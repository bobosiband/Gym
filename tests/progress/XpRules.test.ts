import { SetXpRule } from '@gym/exercise-core';
import { PushupXpRule } from '@gym/exercise-pushup';
import { describe, expect, it } from 'vitest';

import { XpRules } from '../../services/progress/src/progress/XpRules.js';

/**
 * Per-event XP now lives on each exercise's own {@link XpRule}
 * strategy, not on {@link XpRules}. These tests cover both sides of
 * the split: the strategies score events, and {@link XpRules} owns
 * only the level curve.
 */
describe('PushupXpRule.baseXp', () => {
  it('awards one XP per ten push-up reps', () => {
    const rule = new PushupXpRule();
    expect(rule.baseXp({ reps: 100 })).toBe(10);
    expect(rule.baseXp({ reps: 9 })).toBe(0);
    expect(rule.baseXp({ reps: 25 })).toBe(2);
  });
});

describe('SetXpRule.baseXp', () => {
  it('awards a flat ten XP for a resistance set regardless of reps', () => {
    const rule = new SetXpRule();
    expect(rule.baseXp({ reps: 1 })).toBe(10);
    expect(rule.baseXp({ reps: 100 })).toBe(10);
  });
});

describe('XpRules.levelForXp', () => {
  it('returns 1 for everything below 100 XP', () => {
    expect(XpRules.levelForXp(0)).toBe(1);
    expect(XpRules.levelForXp(99)).toBe(1);
  });

  it('follows the quadratic curve', () => {
    expect(XpRules.levelForXp(100)).toBe(1);
    expect(XpRules.levelForXp(400)).toBe(2);
    expect(XpRules.levelForXp(900)).toBe(3);
    expect(XpRules.levelForXp(1_000)).toBe(3);
  });
});

describe('XpRules.xpToNextLevel', () => {
  it('reports the exact distance to the next level boundary', () => {
    expect(XpRules.xpToNextLevel(0)).toBe(400);
    expect(XpRules.xpToNextLevel(399)).toBe(1);
    expect(XpRules.xpToNextLevel(400)).toBe(500);
  });
});
