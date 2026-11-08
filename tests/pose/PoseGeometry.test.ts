import { describe, expect, it } from 'vitest';

import { PoseGeometry } from '../../packages/pose/src/PoseGeometry.js';

describe('PoseGeometry.jointAngleDegrees', () => {
  it('returns 180 when the three points are colinear', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 1 };
    const c = { x: 0, y: 2 };
    expect(PoseGeometry.jointAngleDegrees(a, b, c)).toBeCloseTo(180, 5);
  });

  it('returns 90 for a right angle at the joint', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 1 };
    const c = { x: 1, y: 1 };
    expect(PoseGeometry.jointAngleDegrees(a, b, c)).toBeCloseTo(90, 5);
  });

  it('returns 180 when two points coincide (degenerate vector)', () => {
    const a = { x: 0, y: 1 };
    const b = { x: 0, y: 1 };
    const c = { x: 1, y: 1 };
    expect(PoseGeometry.jointAngleDegrees(a, b, c)).toBe(180);
  });

  it('returns the measured angle for an acute bend', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 1 };
    const c = { x: 0.5, y: 1.866 };
    expect(PoseGeometry.jointAngleDegrees(a, b, c)).toBeCloseTo(150, 1);
  });
});
