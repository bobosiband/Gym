import { describe, expect, it } from 'vitest';

import { DropoutTolerance } from '../../packages/exercise-pushup/src/strategies/DropoutTolerance.js';

describe('DropoutTolerance', () => {
  it('reports the limit as not exceeded while the miss streak is within the window', () => {
    const tolerance = new DropoutTolerance({ maxMissFrames: 6 });
    for (let i = 0; i < 6; i += 1) {
      expect(tolerance.observeMiss()).toBe(false);
    }
  });

  it('reports the limit as exceeded on the frame past the configured window', () => {
    const tolerance = new DropoutTolerance({ maxMissFrames: 6 });
    for (let i = 0; i < 6; i += 1) {
      tolerance.observeMiss();
    }
    expect(tolerance.observeMiss()).toBe(true);
  });

  it('observeOk clears the miss streak so the next miss starts fresh', () => {
    const tolerance = new DropoutTolerance({ maxMissFrames: 2 });
    tolerance.observeMiss();
    tolerance.observeMiss();
    tolerance.observeOk();
    expect(tolerance.observeMiss()).toBe(false);
    expect(tolerance.observeMiss()).toBe(false);
    expect(tolerance.observeMiss()).toBe(true);
  });
});
