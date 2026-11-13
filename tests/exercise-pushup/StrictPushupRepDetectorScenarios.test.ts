import { describe, expect, it } from 'vitest';

import { StrictPushupRepDetector } from '../../packages/exercise-pushup/src/StrictPushupRepDetector.js';
import { RepCounter } from '../../packages/pose/src/RepCounter.js';
import {
  dropoutFrame,
  frontPushupFrame,
  pushupFrame,
  seatedFrame,
} from '../pushup-counter/support/Frames.js';

interface FakeClock {
  now(): number;
  advance(ms: number): void;
}

function fakeClock(startMs: number = 1000): FakeClock {
  let current = startMs;
  return {
    now: (): number => current,
    advance: (ms: number): void => {
      current += ms;
    },
  };
}

/**
 * Hand-authored scenarios mirroring the four acceptance tests from
 * the owner brief. Each scenario synthesises a MediaPipe frame
 * sequence through the shared `Frames` helpers and verifies the
 * detector's behaviour end-to-end through {@link StrictPushupRepDetector}.
 */
describe('StrictPushupRepDetector scenarios', () => {
  it('front view, close camera, only head/shoulders/arms visible: ten full reps count ten', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    // Prime the baseline with a quiet top window so calibration anchors a tight "up" reference.
    for (let i = 0; i < 10; i += 1) {
      counter.processFrame(
        frontPushupFrame({ leftElbowDeg: 170, rightElbowDeg: 170, shoulderY: 0.2, shoulderHalfWidth: 0.15 })
      );
      clock.advance(100);
    }
    // Each rep: shoulders drop from 0.2 to 0.32 and the shoulder half-width
    // grows from 0.15 to 0.19 (close-to-camera foreshortening).
    for (let rep = 0; rep < 10; rep += 1) {
      const cycle: ReadonlyArray<{ y: number; w: number }> = [
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
      for (const frame of cycle) {
        counter.processFrame(
          frontPushupFrame({
            leftElbowDeg: 170,
            rightElbowDeg: 170,
            shoulderY: frame.y,
            shoulderHalfWidth: frame.w,
          })
        );
        clock.advance(100);
      }
    }
    expect(counter.getCount()).toBe(10);
  });

  it('side view, far arm low visibility: full reps still count', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    const cycle: ReadonlyArray<{ angle: number; shoulderY: number }> = [
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 140, shoulderY: 0.44 },
      { angle: 110, shoulderY: 0.48 },
      { angle: 80, shoulderY: 0.52 },
      { angle: 80, shoulderY: 0.52 },
      { angle: 80, shoulderY: 0.52 },
      { angle: 80, shoulderY: 0.52 },
      { angle: 80, shoulderY: 0.52 },
      { angle: 110, shoulderY: 0.48 },
      { angle: 140, shoulderY: 0.44 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
    ];
    for (let rep = 0; rep < 3; rep += 1) {
      for (const frame of cycle) {
        counter.processFrame(
          pushupFrame({
            leftElbowDeg: frame.angle,
            rightElbowDeg: frame.angle,
            shoulderY: frame.shoulderY,
            hipY: 0.5,
            leftArmVisibility: 0.08,
            rightArmVisibility: 0.95,
          })
        );
        clock.advance(150);
      }
    }
    expect(counter.getCount()).toBe(3);
  });

  it('half reps do not count as reps', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    const halfRepCycle: ReadonlyArray<{ angle: number; shoulderY: number }> = [
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 140, shoulderY: 0.42 },
      { angle: 125, shoulderY: 0.44 },
      { angle: 140, shoulderY: 0.42 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
    ];
    for (let rep = 0; rep < 5; rep += 1) {
      for (const frame of halfRepCycle) {
        counter.processFrame(
          pushupFrame({
            leftElbowDeg: frame.angle,
            rightElbowDeg: frame.angle,
            shoulderY: frame.shoulderY,
            hipY: 0.5,
          })
        );
        clock.advance(80);
      }
    }
    expect(counter.getCount()).toBe(0);
  });

  it('sitting arm bends do not count as reps', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    for (let i = 0; i < 50; i += 1) {
      const angle = i % 10 < 5 ? 170 - i * 5 : 60 + (i % 10) * 20;
      counter.processFrame(seatedFrame(angle));
      clock.advance(60);
    }
    expect(counter.getCount()).toBe(0);
  });

  it('waving the arms does not count as reps', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    for (let i = 0; i < 60; i += 1) {
      const angle = i % 2 === 0 ? 170 : 80;
      counter.processFrame(seatedFrame(angle));
      clock.advance(60);
    }
    expect(counter.getCount()).toBe(0);
  });

  it('arm-only front-view bends with no shoulder descent do not count as reps', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    for (let i = 0; i < 60; i += 1) {
      const angle = i % 2 === 0 ? 170 : 90;
      counter.processFrame(
        frontPushupFrame({
          leftElbowDeg: angle,
          rightElbowDeg: angle,
          shoulderY: 0.25,
          shoulderHalfWidth: 0.15,
        })
      );
      clock.advance(60);
    }
    expect(counter.getCount()).toBe(0);
  });

  it('a brief posture dropout mid-rep does not lose the rep', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    const cycle: ReadonlyArray<{ angle: number; shoulderY: number }> = [
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 140, shoulderY: 0.44 },
      { angle: 110, shoulderY: 0.48 },
      { angle: 80, shoulderY: 0.52 },
      { angle: 80, shoulderY: 0.52 },
      { angle: 80, shoulderY: 0.52 },
      { angle: 80, shoulderY: 0.52 },
      { angle: 80, shoulderY: 0.52 },
      { angle: 110, shoulderY: 0.48 },
      { angle: 140, shoulderY: 0.44 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
    ];
    for (let i = 0; i < cycle.length; i += 1) {
      if (i === 10) {
        // A single dropout frame at the deepest point of the rep.
        counter.processFrame(dropoutFrame());
      } else {
        const frame = cycle[i];
        counter.processFrame(
          pushupFrame({
            leftElbowDeg: frame.angle,
            rightElbowDeg: frame.angle,
            shoulderY: frame.shoulderY,
            hipY: 0.5,
          })
        );
      }
      clock.advance(150);
    }
    expect(counter.getCount()).toBe(1);
  });
});
