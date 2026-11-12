import { describe, expect, it } from 'vitest';

import { ViewDetector } from '../../packages/exercise-pushup/src/strategies/ViewDetector.js';
import {
  frontPushupFrame,
  sidePushupFrame,
  seatedFrame,
} from '../pushup-counter/support/Frames.js';

describe('ViewDetector', () => {
  it('settles on side after three consecutive side readings', () => {
    const detector = new ViewDetector();
    const frame = sidePushupFrame({ leftElbowDeg: 170, rightElbowDeg: 170 });
    detector.observe(frame);
    detector.observe(frame);
    const final = detector.observe(frame);
    expect(final).toBe('side');
    expect(detector.getView()).toBe('side');
  });

  it('settles on front after three consecutive front readings when hips are visible', () => {
    const detector = new ViewDetector();
    const frame = frontPushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      hipsVisible: true,
    });
    detector.observe(frame);
    detector.observe(frame);
    const final = detector.observe(frame);
    expect(final).toBe('front');
  });

  it('holds the current view through a single rogue frame', () => {
    const detector = new ViewDetector();
    const side = sidePushupFrame({ leftElbowDeg: 170, rightElbowDeg: 170 });
    const rogueFront = seatedFrame(170);
    detector.observe(side);
    detector.observe(side);
    detector.observe(side);
    expect(detector.getView()).toBe('side');
    const after = detector.observe(rogueFront);
    expect(after).toBe('side');
    expect(detector.getView()).toBe('side');
  });

  it('falls back to the shoulder-width ratio when hips are not visible', () => {
    const detector = new ViewDetector();
    const frame = frontPushupFrame({
      leftElbowDeg: 170,
      rightElbowDeg: 170,
      hipsVisible: false,
    });
    detector.observe(frame);
    detector.observe(frame);
    const final = detector.observe(frame);
    expect(final).toBe('front');
  });

  it('resets to unknown and requires the confirmation streak again', () => {
    const detector = new ViewDetector();
    const frame = sidePushupFrame({ leftElbowDeg: 170, rightElbowDeg: 170 });
    detector.observe(frame);
    detector.observe(frame);
    detector.observe(frame);
    expect(detector.getView()).toBe('side');
    detector.reset();
    expect(detector.getView()).toBe('unknown');
    detector.observe(frame);
    expect(detector.getView()).toBe('unknown');
  });
});
