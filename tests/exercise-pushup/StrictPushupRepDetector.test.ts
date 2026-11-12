import { describe, expect, it } from 'vitest';

import { StrictPushupRepDetector } from '../../packages/exercise-pushup/src/StrictPushupRepDetector.js';
import { RepCounter } from '../../packages/pose/src/RepCounter.js';
import { pushupFrame, seatedFrame } from '../pushup-counter/support/Frames.js';

/** Build a frame with both elbows at `angle` in a plausible push-up pose. */
function rep(angle: number, shoulderY: number = 0.4): ReturnType<typeof pushupFrame> {
  return pushupFrame({
    leftElbowDeg: angle,
    rightElbowDeg: angle,
    shoulderY,
    hipY: 0.5,
  });
}

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

/** Feed a sequence of (angle, shoulderY) frames, stepping the clock. */
function feedSequence(
  counter: RepCounter,
  clock: FakeClock,
  frames: ReadonlyArray<{ readonly angle: number; readonly shoulderY: number }>,
  stepMs: number
): void {
  for (const f of frames) {
    counter.processFrame(rep(f.angle, f.shoulderY));
    clock.advance(stepMs);
  }
}

/** Shoulder y stays high (near 0.4) during the up phase, drops to 0.52 during down. */
function cleanRepFrames(): ReadonlyArray<{ readonly angle: number; readonly shoulderY: number }> {
  return [
    { angle: 170, shoulderY: 0.4 },
    { angle: 170, shoulderY: 0.4 },
    { angle: 170, shoulderY: 0.4 },
    { angle: 170, shoulderY: 0.4 },
    { angle: 170, shoulderY: 0.4 },
    { angle: 140, shoulderY: 0.44 },
    { angle: 110, shoulderY: 0.48 },
    { angle: 85, shoulderY: 0.52 },
    { angle: 85, shoulderY: 0.52 },
    { angle: 85, shoulderY: 0.52 },
    { angle: 85, shoulderY: 0.52 },
    { angle: 85, shoulderY: 0.52 },
    { angle: 110, shoulderY: 0.48 },
    { angle: 140, shoulderY: 0.44 },
    { angle: 170, shoulderY: 0.4 },
    { angle: 170, shoulderY: 0.4 },
    { angle: 170, shoulderY: 0.4 },
    { angle: 170, shoulderY: 0.4 },
    { angle: 170, shoulderY: 0.4 },
  ];
}

describe('StrictPushupRepDetector', () => {
  it('counts one rep for a clean down-then-up cycle in push-up posture', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    feedSequence(counter, clock, cleanRepFrames(), 100);
    expect(counter.getCount()).toBe(1);
  });

  it('counts five reps for five full cycles', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    for (let i = 0; i < 5; i += 1) {
      feedSequence(counter, clock, cleanRepFrames(), 100);
    }
    expect(counter.getCount()).toBe(5);
  });

  it('rejects a seated arm bend (torso upright, no shoulder drop)', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    for (let i = 0; i < 20; i += 1) {
      const angle = i < 10 ? 170 - i * 10 : 80 + (i - 10) * 10;
      counter.processFrame(seatedFrame(angle));
      clock.advance(60);
    }
    expect(counter.getCount()).toBe(0);
  });

  it('rejects a hand wave (no posture even though elbow angle swings)', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    for (let i = 0; i < 30; i += 1) {
      const angle = i % 2 === 0 ? 80 : 170;
      counter.processFrame(seatedFrame(angle));
      clock.advance(60);
    }
    expect(counter.getCount()).toBe(0);
  });

  it('rejects threshold jitter without a real rep', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    for (let i = 0; i < 30; i += 1) {
      const angle = 155 + ((i % 2) - 0) * 10;
      feedSequence(counter, clock, [{ angle, shoulderY: 0.4 }], 60);
    }
    expect(counter.getCount()).toBe(0);
  });

  it('rejects a partial rep that never reaches the down threshold', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    const frames = [
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 140, shoulderY: 0.42 },
      { angle: 120, shoulderY: 0.44 },
      { angle: 110, shoulderY: 0.46 },
      { angle: 140, shoulderY: 0.42 },
      { angle: 170, shoulderY: 0.4 },
      { angle: 170, shoulderY: 0.4 },
    ];
    feedSequence(counter, clock, frames, 60);
    expect(counter.getCount()).toBe(0);
  });

  it('rejects a rep completed in less than the minimum duration', () => {
    const clock = fakeClock();
    const counter = new RepCounter(
      new StrictPushupRepDetector({
        now: clock.now,
        timing: { minRepSeconds: 0.5, maxRepSeconds: 10 },
      })
    );
    feedSequence(counter, clock, cleanRepFrames(), 10);
    expect(counter.getCount()).toBe(0);
  });

  it('rejects a rep that holds the down state longer than the maximum duration', () => {
    const clock = fakeClock();
    const counter = new RepCounter(
      new StrictPushupRepDetector({
        now: clock.now,
        timing: { minRepSeconds: 0.5, maxRepSeconds: 5 },
      })
    );
    feedSequence(counter, clock, cleanRepFrames(), 1000);
    expect(counter.getCount()).toBe(0);
  });

  it('still counts when one arm is occluded as long as posture and shoulder drop hold', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    const framesWithLeftOccluded = cleanRepFrames().map((f) =>
      pushupFrame({
        leftElbowDeg: f.angle,
        rightElbowDeg: f.angle,
        shoulderY: f.shoulderY,
        hipY: 0.5,
        leftArmVisibility: 0.1,
        rightArmVisibility: 0.95,
      })
    );
    for (const frame of framesWithLeftOccluded) {
      counter.processFrame(frame);
      clock.advance(100);
    }
    expect(counter.getCount()).toBe(1);
  });

  it('pauses with a posture label when the user sits up mid-session', () => {
    const clock = fakeClock();
    const detector = new StrictPushupRepDetector({ now: clock.now });
    const counter = new RepCounter(detector);
    counter.processFrame(rep(170));
    clock.advance(60);
    counter.processFrame(seatedFrame(170));
    expect(counter.getLastObservation()?.phaseLabel).toBe('pause');
  });

  it('reset clears the state machine', () => {
    const clock = fakeClock();
    const counter = new RepCounter(new StrictPushupRepDetector({ now: clock.now }));
    feedSequence(counter, clock, cleanRepFrames(), 100);
    expect(counter.getCount()).toBe(1);
    counter.reset();
    expect(counter.getCount()).toBe(0);
    expect(counter.getLastObservation()).toBeNull();
  });
});
