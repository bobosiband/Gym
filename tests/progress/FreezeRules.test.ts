import { describe, expect, it } from 'vitest';

import { FreezeRules } from '../../services/progress/src/progress/FreezeRules.js';

describe('FreezeRules.grant', () => {
  it('adds freezes up to the cap', () => {
    expect(FreezeRules.grant(0, 1)).toBe(1);
    expect(FreezeRules.grant(1, 1)).toBe(2);
  });

  it('silently clamps at the cap', () => {
    expect(FreezeRules.grant(2, 1)).toBe(2);
    expect(FreezeRules.grant(0, 5)).toBe(2);
  });

  it('ignores negative requests', () => {
    expect(FreezeRules.grant(1, -5)).toBe(1);
  });
});
