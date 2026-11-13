import { describe, expect, it } from 'vitest';

import { FrontShoulderSignalStrategy } from '../../packages/exercise-pushup/src/strategies/FrontShoulderSignalStrategy.js';
import { frontPushupFrame } from '../pushup-counter/support/Frames.js';

/**
 * Build a front-view frame parameterised by shoulder y and shoulder
 * half-width. The strategy ignores elbow angles, so the arm angle is
 * fixed at 170 (straight).
 */
function frontFrame(shoulderY: number, shoulderHalfWidth: number = 0.15) {
  return frontPushupFrame({
    leftElbowDeg: 170,
    rightElbowDeg: 170,
    shoulderY,
    shoulderHalfWidth,
  });
}

describe('FrontShoulderSignalStrategy', () => {
  it('counts one rep when shoulders drop and widen together', () => {
    const strategy = new FrontShoulderSignalStrategy();
    const frames = [
      ...Array.from({ length: 5 }, () => ({ y: 0.2, w: 0.15 })),
      { y: 0.24, w: 0.16 },
      { y: 0.28, w: 0.17 },
      { y: 0.32, w: 0.19 },
      { y: 0.32, w: 0.19 },
      { y: 0.32, w: 0.19 },
      { y: 0.28, w: 0.17 },
      { y: 0.24, w: 0.16 },
      ...Array.from({ length: 5 }, () => ({ y: 0.2, w: 0.15 })),
    ];
    let completed = 0;
    let nowMs = 1000;
    for (const f of frames) {
      const result = strategy.processFrame(frontFrame(f.y, f.w), nowMs);
      if (result.repCompleted) {
        completed += 1;
      }
      nowMs += 100;
    }
    expect(completed).toBe(1);
  });

  it('rejects an arm bend with no shoulder descent (width constant, y constant)', () => {
    const strategy = new FrontShoulderSignalStrategy();
    const frames = Array.from({ length: 20 }, () => ({ y: 0.2, w: 0.15 }));
    let completed = 0;
    let nowMs = 1000;
    for (const f of frames) {
      const result = strategy.processFrame(frontFrame(f.y, f.w), nowMs);
      if (result.repCompleted) {
        completed += 1;
      }
      nowMs += 100;
    }
    expect(completed).toBe(0);
  });

  it('rejects descent without matching width growth (torso drops but chest never nears camera)', () => {
    const strategy = new FrontShoulderSignalStrategy();
    const frames = [
      ...Array.from({ length: 5 }, () => ({ y: 0.2, w: 0.15 })),
      { y: 0.26, w: 0.15 },
      { y: 0.32, w: 0.15 },
      { y: 0.32, w: 0.15 },
      { y: 0.32, w: 0.15 },
      { y: 0.26, w: 0.15 },
      ...Array.from({ length: 5 }, () => ({ y: 0.2, w: 0.15 })),
    ];
    let completed = 0;
    let nowMs = 1000;
    for (const f of frames) {
      const result = strategy.processFrame(frontFrame(f.y, f.w), nowMs);
      if (result.repCompleted) {
        completed += 1;
      }
      nowMs += 100;
    }
    expect(completed).toBe(0);
  });

  it('reports face-or-shoulders-not-visible when the landmarks drop', () => {
    const strategy = new FrontShoulderSignalStrategy();
    const empty = frontPushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      visibility: 0.05,
    });
    const result = strategy.processFrame(empty, 1000);
    expect(result.inPosition).toBe(false);
    expect(result.failReason).toBe('face or shoulders not visible');
  });

  it('counts ten reps in a row', () => {
    const strategy = new FrontShoulderSignalStrategy();
    let completed = 0;
    let nowMs = 1000;
    // Start with a steady "top" window so calibration finds a baseline.
    for (let i = 0; i < 10; i += 1) {
      strategy.processFrame(frontFrame(0.2, 0.15), nowMs);
      nowMs += 100;
    }
    for (let rep = 0; rep < 10; rep += 1) {
      const cycle = [
        { y: 0.24, w: 0.16 },
        { y: 0.28, w: 0.17 },
        { y: 0.32, w: 0.19 },
        { y: 0.32, w: 0.19 },
        { y: 0.32, w: 0.19 },
        { y: 0.28, w: 0.17 },
        { y: 0.24, w: 0.16 },
        { y: 0.2, w: 0.15 },
        { y: 0.2, w: 0.15 },
        { y: 0.2, w: 0.15 },
      ];
      for (const f of cycle) {
        const result = strategy.processFrame(frontFrame(f.y, f.w), nowMs);
        if (result.repCompleted) {
          completed += 1;
        }
        nowMs += 100;
      }
    }
    expect(completed).toBe(10);
  });

  it('reset clears calibration so the next rep anchors from a fresh baseline', () => {
    const strategy = new FrontShoulderSignalStrategy();
    // Pretend the user did a full session in a deep position; this
    // seeds the strategy's calibration buffers.
    for (let i = 0; i < 10; i += 1) {
      strategy.processFrame(frontFrame(0.32, 0.19), 1000 + i * 100);
    }
    strategy.reset();
    // After reset the first "up" frame should NOT register a stale
    // down-to-up transition (no rep).
    const result = strategy.processFrame(frontFrame(0.2, 0.15), 3000);
    expect(result.repCompleted).toBe(false);
  });
});
