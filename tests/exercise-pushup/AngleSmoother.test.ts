import { describe, expect, it } from 'vitest';

import { AngleSmoother } from '../../packages/exercise-pushup/src/strategies/AngleSmoother.js';

describe('AngleSmoother', () => {
  it('returns the single sample before the window is full', () => {
    const smoother = new AngleSmoother(5);
    expect(smoother.push(170)).toBe(170);
  });

  it('averages samples while the window fills', () => {
    const smoother = new AngleSmoother(5);
    smoother.push(100);
    smoother.push(120);
    expect(smoother.push(140)).toBeCloseTo(120, 6);
  });

  it('drops the oldest sample once the window is full', () => {
    const smoother = new AngleSmoother(3);
    smoother.push(100);
    smoother.push(100);
    smoother.push(100);
    expect(smoother.push(130)).toBeCloseTo(110, 6);
  });

  it('coerces a non-positive window to 1 sample', () => {
    const smoother = new AngleSmoother(0);
    smoother.push(90);
    expect(smoother.push(170)).toBe(170);
  });

  it('reset clears the running mean', () => {
    const smoother = new AngleSmoother(3);
    smoother.push(90);
    smoother.push(170);
    smoother.reset();
    expect(smoother.value()).toBeNull();
    expect(smoother.push(50)).toBe(50);
  });
});
