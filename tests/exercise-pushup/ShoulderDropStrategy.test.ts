import { describe, expect, it } from 'vitest';

import { ShoulderDropStrategy } from '../../packages/exercise-pushup/src/strategies/ShoulderDropStrategy.js';
import { pushupFrame } from '../pushup-counter/support/Frames.js';

describe('ShoulderDropStrategy', () => {
  it('reports insufficient drop before any up anchor is set', () => {
    const strategy = new ShoulderDropStrategy();
    expect(strategy.isDropSufficient()).toBe(false);
  });

  it('reports sufficient drop when the shoulders travel a large fraction of the torso length', () => {
    const strategy = new ShoulderDropStrategy({ minShoulderDropRatio: 0.25 });
    const upFrame = pushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      shoulderY: 0.4,
      hipY: 0.5,
    });
    const downFrame = pushupFrame({
      leftElbowDeg: 90,
      rightElbowDeg: 90,
      shoulderY: 0.48,
      hipY: 0.5,
    });
    strategy.markUp(upFrame);
    strategy.observe(downFrame);
    expect(strategy.isDropSufficient()).toBe(true);
  });

  it('reports insufficient drop when the shoulders barely move (seated arm bend case)', () => {
    const strategy = new ShoulderDropStrategy({ minShoulderDropRatio: 0.25 });
    const upFrame = pushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      shoulderY: 0.4,
      hipY: 0.5,
    });
    const nearStaticFrame = pushupFrame({
      leftElbowDeg: 90,
      rightElbowDeg: 90,
      shoulderY: 0.401,
      hipY: 0.5,
    });
    strategy.markUp(upFrame);
    strategy.observe(nearStaticFrame);
    expect(strategy.isDropSufficient()).toBe(false);
  });

  it('reset clears the up anchor and peak', () => {
    const strategy = new ShoulderDropStrategy({ minShoulderDropRatio: 0.25 });
    const upFrame = pushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      shoulderY: 0.4,
      hipY: 0.5,
    });
    const downFrame = pushupFrame({
      leftElbowDeg: 90,
      rightElbowDeg: 90,
      shoulderY: 0.48,
      hipY: 0.5,
    });
    strategy.markUp(upFrame);
    strategy.observe(downFrame);
    strategy.reset();
    expect(strategy.isDropSufficient()).toBe(false);
  });
});
