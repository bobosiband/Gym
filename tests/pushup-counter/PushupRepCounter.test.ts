import { describe, expect, it } from 'vitest';

import { PushupRepCounter } from '../../apps/pushup-counter/src/PushupRepCounter.js';
import { armFrameAtAngle } from './support/Frames.js';

/**
 * Replay a sequence of elbow angles through the counter.
 */
function run(counter: PushupRepCounter, angles: readonly number[]): void {
  for (const angle of angles) {
    counter.processFrame(armFrameAtAngle(angle));
  }
}

describe('PushupRepCounter', () => {
  it('counts a single rep when the user goes down past 90 and back up past 160', () => {
    const counter = new PushupRepCounter();
    run(counter, [170, 150, 120, 85, 120, 170]);
    expect(counter.getCount()).toBe(1);
    expect(counter.getPhase()).toBe('up');
  });

  it('counts two reps across two full cycles', () => {
    const counter = new PushupRepCounter();
    run(counter, [170, 85, 170, 85, 170]);
    expect(counter.getCount()).toBe(2);
  });

  it('does not count a rep when the user never reaches full extension', () => {
    const counter = new PushupRepCounter();
    run(counter, [170, 85, 150, 85, 150]);
    expect(counter.getCount()).toBe(0);
  });

  it('does not count a rep when the user never bends past 90', () => {
    const counter = new PushupRepCounter();
    run(counter, [170, 120, 100, 95, 100, 170]);
    expect(counter.getCount()).toBe(0);
  });

  it('resets state so a new session starts at zero', () => {
    const counter = new PushupRepCounter();
    run(counter, [170, 85, 170]);
    expect(counter.getCount()).toBe(1);
    counter.reset();
    expect(counter.getCount()).toBe(0);
    expect(counter.getPhase()).toBe('unknown');
    expect(counter.getLastElbowAngle()).toBeNull();
  });

  it('respects custom thresholds', () => {
    const counter = new PushupRepCounter({ downAngleDegrees: 80, upAngleDegrees: 170 });
    run(counter, [175, 85, 175]);
    expect(counter.getCount()).toBe(0);
    run(counter, [175, 70, 175]);
    expect(counter.getCount()).toBe(1);
  });

  it('ignores frames whose visibility is below the floor', () => {
    const counter = new PushupRepCounter();
    counter.processFrame(armFrameAtAngle(170));
    counter.processFrame(armFrameAtAngle(85, 0.1));
    counter.processFrame(armFrameAtAngle(170));
    expect(counter.getCount()).toBe(0);
  });

  it('counts across a dropped frame', () => {
    const counter = new PushupRepCounter();
    counter.processFrame(armFrameAtAngle(170));
    counter.processFrame(armFrameAtAngle(85));
    counter.processFrame(armFrameAtAngle(85, 0.1));
    counter.processFrame(armFrameAtAngle(170));
    expect(counter.getCount()).toBe(1);
  });
});
