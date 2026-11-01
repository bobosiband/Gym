import { describe, expect, it } from 'vitest';

import { ElbowAngle } from '../../apps/pushup-counter/src/ElbowAngle.js';

describe('ElbowAngle', () => {
  it('returns 180 when the arm is straight', () => {
    const shoulder = { x: 0, y: 0 };
    const elbow = { x: 0, y: 1 };
    const wrist = { x: 0, y: 2 };
    expect(ElbowAngle.betweenShoulderElbowWrist(shoulder, elbow, wrist)).toBeCloseTo(180, 5);
  });

  it('returns 90 for a right angle at the elbow', () => {
    const shoulder = { x: 0, y: 0 };
    const elbow = { x: 0, y: 1 };
    const wrist = { x: 1, y: 1 };
    expect(ElbowAngle.betweenShoulderElbowWrist(shoulder, elbow, wrist)).toBeCloseTo(90, 5);
  });

  it('returns 180 when the shoulder coincides with the elbow', () => {
    const shoulder = { x: 0, y: 1 };
    const elbow = { x: 0, y: 1 };
    const wrist = { x: 1, y: 1 };
    expect(ElbowAngle.betweenShoulderElbowWrist(shoulder, elbow, wrist)).toBe(180);
  });

  it('returns the smaller angle for an acute bend', () => {
    const shoulder = { x: 0, y: 0 };
    const elbow = { x: 0, y: 1 };
    const wrist = { x: 0.5, y: 1.866 };
    expect(ElbowAngle.betweenShoulderElbowWrist(shoulder, elbow, wrist)).toBeCloseTo(150, 1);
  });
});
