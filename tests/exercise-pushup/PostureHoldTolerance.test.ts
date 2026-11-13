import { describe, expect, it } from 'vitest';

import { PostureHoldTolerance } from '../../packages/exercise-pushup/src/strategies/PostureHoldTolerance.js';

describe('PostureHoldTolerance', () => {
  it('returns false on the first miss', () => {
    const tol = new PostureHoldTolerance({ pauseAfterMs: 1000 });
    expect(tol.observeMiss(1000)).toBe(false);
  });

  it('returns false while the streak is under the pause window', () => {
    const tol = new PostureHoldTolerance({ pauseAfterMs: 1000 });
    tol.observeMiss(1000);
    expect(tol.observeMiss(1500)).toBe(false);
    expect(tol.observeMiss(1900)).toBe(false);
  });

  it('returns true once the streak reaches the pause window', () => {
    const tol = new PostureHoldTolerance({ pauseAfterMs: 1000 });
    tol.observeMiss(1000);
    expect(tol.observeMiss(2000)).toBe(true);
  });

  it('observeOk clears the streak so the next miss starts fresh', () => {
    const tol = new PostureHoldTolerance({ pauseAfterMs: 1000 });
    tol.observeMiss(1000);
    tol.observeMiss(1500);
    tol.observeOk();
    expect(tol.observeMiss(2500)).toBe(false);
  });

  it('reset clears the streak', () => {
    const tol = new PostureHoldTolerance({ pauseAfterMs: 1000 });
    tol.observeMiss(1000);
    tol.reset();
    expect(tol.observeMiss(2500)).toBe(false);
  });
});
