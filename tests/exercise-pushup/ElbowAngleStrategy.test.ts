import { describe, expect, it } from 'vitest';

import { ElbowAngleStrategy } from '../../packages/exercise-pushup/src/strategies/ElbowAngleStrategy.js';
import { pushupFrame } from '../pushup-counter/support/Frames.js';

describe('ElbowAngleStrategy', () => {
  it('returns the symmetric angle for a symmetric frame', () => {
    const strategy = new ElbowAngleStrategy();
    const frame = pushupFrame({ leftElbowDeg: 90, rightElbowDeg: 90 });
    const reading = strategy.evaluate(frame);
    expect(reading).not.toBeNull();
    expect(reading!.maxAngle).toBeCloseTo(90, 1);
    expect(reading!.minAngle).toBeCloseTo(90, 1);
    expect(reading!.displayAngle).toBeCloseTo(90, 1);
  });

  it('returns max and min when the arms differ', () => {
    const strategy = new ElbowAngleStrategy();
    const frame = pushupFrame({ leftElbowDeg: 80, rightElbowDeg: 120 });
    const reading = strategy.evaluate(frame);
    expect(reading).not.toBeNull();
    expect(reading!.minAngle).toBeCloseTo(80, 1);
    expect(reading!.maxAngle).toBeCloseTo(120, 1);
    expect(reading!.displayAngle).toBeCloseTo(100, 1);
  });

  it('falls back to the one visible arm when the other is occluded', () => {
    const strategy = new ElbowAngleStrategy();
    const frame = pushupFrame({
      leftElbowDeg: 85,
      rightElbowDeg: 85,
      leftArmVisibility: 0.1,
      rightArmVisibility: 0.95,
    });
    const reading = strategy.evaluate(frame);
    expect(reading).not.toBeNull();
    expect(reading!.minAngle).toBeCloseTo(85, 1);
    expect(reading!.maxAngle).toBeCloseTo(85, 1);
  });

  it('returns null when both arms are occluded', () => {
    const strategy = new ElbowAngleStrategy();
    const frame = pushupFrame({
      leftElbowDeg: 85,
      rightElbowDeg: 85,
      leftArmVisibility: 0.1,
      rightArmVisibility: 0.1,
    });
    expect(strategy.evaluate(frame)).toBeNull();
  });

  it('respects a custom minVisibility', () => {
    const strategy = new ElbowAngleStrategy({ minVisibility: 0.8 });
    const frame = pushupFrame({
      leftElbowDeg: 85,
      rightElbowDeg: 85,
      visibility: 0.7,
    });
    expect(strategy.evaluate(frame)).toBeNull();
  });
});
