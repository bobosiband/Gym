import { describe, expect, it } from 'vitest';

import { SideArmElbowStrategy } from '../../packages/exercise-pushup/src/strategies/SideArmElbowStrategy.js';
import { pushupFrame, seatedFrame } from '../pushup-counter/support/Frames.js';

/** Build a side-view frame with one arm occluded (very low visibility). */
function farArmOccludedFrame(angle: number) {
  return pushupFrame({
    leftElbowDeg: angle,
    rightElbowDeg: angle,
    shoulderY: 0.4,
    hipY: 0.5,
    leftArmVisibility: 0.05,
    rightArmVisibility: 0.95,
  });
}

/** Full plank frame with both elbows at the given angle. */
function sideFrame(angle: number) {
  return pushupFrame({
    leftElbowDeg: angle,
    rightElbowDeg: angle,
    shoulderY: 0.4,
    hipY: 0.5,
  });
}

describe('SideArmElbowStrategy', () => {
  it('counts one rep for a full down-then-up cycle', () => {
    const strategy = new SideArmElbowStrategy();
    const angles = [170, 170, 170, 170, 170, 140, 110, 85, 85, 85, 85, 85, 110, 140, 170, 170, 170];
    let completed = 0;
    let nowMs = 1000;
    for (const a of angles) {
      const result = strategy.processFrame(sideFrame(a), nowMs);
      if (result.repCompleted) {
        completed += 1;
      }
      nowMs += 100;
    }
    expect(completed).toBe(1);
  });

  it('still counts when the far arm is occluded', () => {
    const strategy = new SideArmElbowStrategy();
    const angles = [170, 170, 170, 170, 170, 140, 110, 85, 85, 85, 85, 85, 110, 140, 170, 170, 170];
    let completed = 0;
    let nowMs = 1000;
    for (const a of angles) {
      const result = strategy.processFrame(farArmOccludedFrame(a), nowMs);
      if (result.repCompleted) {
        completed += 1;
      }
      nowMs += 100;
    }
    expect(completed).toBe(1);
  });

  it('rejects a seated arm bend because the torso is vertical', () => {
    const strategy = new SideArmElbowStrategy();
    let completed = 0;
    let nowMs = 1000;
    for (let i = 0; i < 20; i += 1) {
      const angle = i < 10 ? 170 - i * 10 : 80 + (i - 10) * 10;
      const result = strategy.processFrame(seatedFrame(angle), nowMs);
      if (result.repCompleted) {
        completed += 1;
      }
      nowMs += 60;
    }
    expect(completed).toBe(0);
  });

  it('surfaces "go lower" when a rep attempt never reaches the down threshold', () => {
    const strategy = new SideArmElbowStrategy();
    const angles = [170, 170, 170, 170, 170, 110, 110, 110, 170, 170, 170, 170];
    let lastFailReason: string | undefined;
    let nowMs = 1000;
    for (const a of angles) {
      const result = strategy.processFrame(sideFrame(a), nowMs);
      if (result.failReason !== undefined) {
        lastFailReason = result.failReason;
      }
      nowMs += 60;
    }
    expect(lastFailReason).toBe('go lower');
  });

  it('reset clears the state machine', () => {
    const strategy = new SideArmElbowStrategy();
    strategy.processFrame(sideFrame(170), 1000);
    strategy.reset();
    const result = strategy.processFrame(sideFrame(170), 1100);
    expect(result.phaseLabel).toBe('up');
  });
});
