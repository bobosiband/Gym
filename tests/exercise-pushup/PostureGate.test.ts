import { describe, expect, it } from 'vitest';

import { PostureGate } from '../../packages/exercise-pushup/src/strategies/PostureGate.js';
import { pushupFrame, seatedFrame } from '../pushup-counter/support/Frames.js';

describe('PostureGate', () => {
  it('accepts a straight horizontal body as in position', () => {
    const gate = new PostureGate();
    const frame = pushupFrame({ leftElbowDeg: 170, rightElbowDeg: 170 });
    const result = gate.evaluate(frame);
    expect(result.inPosition).toBe(true);
  });

  it('rejects an upright seated posture', () => {
    const gate = new PostureGate();
    const frame = seatedFrame(90);
    const result = gate.evaluate(frame);
    expect(result.inPosition).toBe(false);
    expect(result.reason).toMatch(/upright|straight/i);
  });

  it('rejects a body that is not straight (hips sagging below the shoulder-ankle line)', () => {
    const gate = new PostureGate();
    const frame = pushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      shoulderY: 0.4,
      hipY: 0.5,
      ankleY: 0.4,
    });
    const result = gate.evaluate(frame);
    expect(result.inPosition).toBe(false);
    expect(result.reason).toMatch(/straight/i);
  });

  it('rejects a frame with missing required landmarks', () => {
    const gate = new PostureGate();
    const frame = pushupFrame({ leftElbowDeg: 170, rightElbowDeg: 170, visibility: 0.1 });
    const result = gate.evaluate(frame);
    expect(result.inPosition).toBe(false);
    expect(result.reason).toMatch(/visible/i);
  });

  it('rejects an empty frame with no landmarks', () => {
    const gate = new PostureGate();
    const result = gate.evaluate([]);
    expect(result.inPosition).toBe(false);
    expect(result.torsoTiltDegrees).toBeNull();
    expect(result.bodyStraightnessDegrees).toBeNull();
  });
});
