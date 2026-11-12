import { describe, expect, it } from 'vitest';

import { RepTimingGate } from '../../packages/exercise-pushup/src/strategies/RepTimingGate.js';

describe('RepTimingGate', () => {
  it('rejects a rep whose duration is below the minimum', () => {
    const gate = new RepTimingGate({ minRepSeconds: 0.5, maxRepSeconds: 10 });
    gate.markDown(1000);
    expect(gate.isDurationValid(1300)).toBe(false);
  });

  it('accepts a rep whose duration is inside the window', () => {
    const gate = new RepTimingGate({ minRepSeconds: 0.5, maxRepSeconds: 10 });
    gate.markDown(1000);
    expect(gate.isDurationValid(2500)).toBe(true);
  });

  it('rejects a rep whose duration is above the maximum', () => {
    const gate = new RepTimingGate({ minRepSeconds: 0.5, maxRepSeconds: 10 });
    gate.markDown(1000);
    expect(gate.isDurationValid(12500)).toBe(false);
  });

  it('returns false before any down timestamp is recorded', () => {
    const gate = new RepTimingGate();
    expect(gate.isDurationValid(1000)).toBe(false);
  });

  it('reset clears the stored down timestamp', () => {
    const gate = new RepTimingGate();
    gate.markDown(1000);
    gate.reset();
    expect(gate.isDurationValid(2500)).toBe(false);
  });
});
