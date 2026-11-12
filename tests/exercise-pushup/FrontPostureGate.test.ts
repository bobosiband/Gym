import { describe, expect, it } from 'vitest';

import { FrontPostureGate } from '../../packages/exercise-pushup/src/strategies/FrontPostureGate.js';
import { frontPushupFrame } from '../pushup-counter/support/Frames.js';

describe('FrontPostureGate', () => {
  it('accepts a front-view push-up frame with wrists below shoulders', () => {
    const gate = new FrontPostureGate();
    const frame = frontPushupFrame({ leftElbowDeg: 170, rightElbowDeg: 170 });
    const result = gate.evaluate(frame);
    expect(result.inPosition).toBe(true);
  });

  it('rejects a frame with the nose below the visibility floor', () => {
    const gate = new FrontPostureGate();
    const frame = frontPushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      visibility: 0.1,
    });
    const result = gate.evaluate(frame);
    expect(result.inPosition).toBe(false);
    expect(result.reason).toMatch(/face/i);
  });

  it('rejects a frame where both wrists sit above the shoulders', () => {
    const gate = new FrontPostureGate();
    const frame = frontPushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      armsUp: true,
    });
    const result = gate.evaluate(frame);
    expect(result.inPosition).toBe(false);
    expect(result.reason).toMatch(/wrists/i);
  });

  it('accepts a frame where only one arm is visible', () => {
    const gate = new FrontPostureGate();
    const frame = frontPushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      leftArmVisibility: 0.1,
    });
    const result = gate.evaluate(frame);
    expect(result.inPosition).toBe(true);
  });

  it('rejects a frame where the shoulders are too close together', () => {
    const gate = new FrontPostureGate();
    const frame = frontPushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      shoulderHalfWidth: 0.02,
    });
    const result = gate.evaluate(frame);
    expect(result.inPosition).toBe(false);
    expect(result.reason).toMatch(/shoulders/i);
  });
});
