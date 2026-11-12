import { describe, expect, it } from 'vitest';

import { FrontDescentStrategy } from '../../packages/exercise-pushup/src/strategies/FrontDescentStrategy.js';
import { frontPushupFrame } from '../pushup-counter/support/Frames.js';

describe('FrontDescentStrategy', () => {
  it('reports insufficient descent before any up anchor is set', () => {
    const strategy = new FrontDescentStrategy();
    expect(strategy.isDescentSufficient()).toBe(false);
  });

  it('reports sufficient descent when the head drops far enough toward the wrists', () => {
    const strategy = new FrontDescentStrategy({ minDescentRatio: 0.25 });
    const upFrame = frontPushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      shoulderY: 0.2,
      shoulderHalfWidth: 0.15,
    });
    const downFrame = frontPushupFrame({
      leftElbowDeg: 90,
      rightElbowDeg: 90,
      shoulderY: 0.35,
      shoulderHalfWidth: 0.15,
    });
    strategy.markUp(upFrame);
    strategy.observe(downFrame);
    expect(strategy.isDescentSufficient()).toBe(true);
  });

  it('reports insufficient descent when the head barely moves', () => {
    const strategy = new FrontDescentStrategy({ minDescentRatio: 0.25 });
    const upFrame = frontPushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      shoulderY: 0.2,
      shoulderHalfWidth: 0.15,
    });
    const nearStaticFrame = frontPushupFrame({
      leftElbowDeg: 90,
      rightElbowDeg: 90,
      shoulderY: 0.205,
      shoulderHalfWidth: 0.15,
    });
    strategy.markUp(upFrame);
    strategy.observe(nearStaticFrame);
    expect(strategy.isDescentSufficient()).toBe(false);
  });

  it('reset clears the baseline and peak', () => {
    const strategy = new FrontDescentStrategy({ minDescentRatio: 0.25 });
    const upFrame = frontPushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      shoulderY: 0.2,
      shoulderHalfWidth: 0.15,
    });
    const downFrame = frontPushupFrame({
      leftElbowDeg: 90,
      rightElbowDeg: 90,
      shoulderY: 0.35,
      shoulderHalfWidth: 0.15,
    });
    strategy.markUp(upFrame);
    strategy.observe(downFrame);
    strategy.reset();
    expect(strategy.isDescentSufficient()).toBe(false);
  });
});
