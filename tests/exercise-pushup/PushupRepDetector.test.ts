import { describe, expect, it } from 'vitest';

import { RepCounter } from '../../packages/pose/src/RepCounter.js';
import { PushupRepDetector } from '../../packages/exercise-pushup/src/PushupRepDetector.js';
import { armFrameAtAngle } from '../pushup-counter/support/Frames.js';

/**
 * Replay a sequence of elbow angles through a generic {@link RepCounter}
 * driven by the {@link PushupRepDetector} strategy. The counter is
 * exercise-agnostic; swapping in a different detector swaps in a
 * different exercise.
 */
function run(counter: RepCounter, angles: readonly number[]): void {
  for (const angle of angles) {
    counter.processFrame(armFrameAtAngle(angle));
  }
}

describe('RepCounter + PushupRepDetector', () => {
  it('counts a single rep on a full down then up cycle', () => {
    const counter = new RepCounter(new PushupRepDetector());
    run(counter, [170, 150, 120, 85, 120, 170]);
    expect(counter.getCount()).toBe(1);
    expect(counter.getLastObservation()?.phaseLabel).toBe('up');
  });

  it('counts two reps across two full cycles', () => {
    const counter = new RepCounter(new PushupRepDetector());
    run(counter, [170, 85, 170, 85, 170]);
    expect(counter.getCount()).toBe(2);
  });

  it('does not count a rep when the user never reaches full extension', () => {
    const counter = new RepCounter(new PushupRepDetector());
    run(counter, [170, 85, 150, 85, 150]);
    expect(counter.getCount()).toBe(0);
  });

  it('does not count a rep when the user never bends past the down threshold', () => {
    const counter = new RepCounter(new PushupRepDetector());
    run(counter, [170, 120, 100, 95, 100, 170]);
    expect(counter.getCount()).toBe(0);
  });

  it('respects custom thresholds supplied to the detector', () => {
    const counter = new RepCounter(
      new PushupRepDetector({ downAngleDegrees: 80, upAngleDegrees: 170 })
    );
    run(counter, [175, 85, 175]);
    expect(counter.getCount()).toBe(0);
    run(counter, [175, 70, 175]);
    expect(counter.getCount()).toBe(1);
  });

  it('resets both the counter total and the detector phase', () => {
    const counter = new RepCounter(new PushupRepDetector());
    run(counter, [170, 85, 170]);
    expect(counter.getCount()).toBe(1);
    counter.reset();
    expect(counter.getCount()).toBe(0);
    expect(counter.getLastObservation()).toBeNull();
  });

  it('ignores frames whose landmarks fall below the visibility floor', () => {
    const counter = new RepCounter(new PushupRepDetector());
    counter.processFrame(armFrameAtAngle(170));
    counter.processFrame(armFrameAtAngle(85, 0.1));
    counter.processFrame(armFrameAtAngle(170));
    expect(counter.getCount()).toBe(0);
  });

  it('counts across a dropped (low-visibility) frame mid-rep', () => {
    const counter = new RepCounter(new PushupRepDetector());
    counter.processFrame(armFrameAtAngle(170));
    counter.processFrame(armFrameAtAngle(85));
    counter.processFrame(armFrameAtAngle(85, 0.1));
    counter.processFrame(armFrameAtAngle(170));
    expect(counter.getCount()).toBe(1);
  });
});
