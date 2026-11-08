import { lazy } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ExerciseCounter } from '../../apps/web/src/counters/ExerciseCounter.js';
import type { ExerciseCounterProps } from '../../apps/web/src/counters/ExerciseCounterComponent.js';
import { ExerciseCounterRegistry } from '../../apps/web/src/counters/ExerciseCounterRegistry.js';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function StubCounter(props: ExerciseCounterProps): JSX.Element {
  return (
    <button type="button" onClick={() => props.onComplete(7)} aria-label="stub-complete">
      Finish stub
    </button>
  );
}

describe('ExerciseCounter', () => {
  it('reports a plain error when no counter is registered for the kind', async () => {
    const registry = new ExerciseCounterRegistry();
    await act(async () => {
      root.render(
        <ExerciseCounter exerciseKind="squat" registry={registry} onComplete={() => undefined} />
      );
    });
    expect(container.textContent).toContain('No on-device counter is registered for squat');
  });

  it('renders the registered lazy component and forwards onComplete', async () => {
    const registry = new ExerciseCounterRegistry();
    registry.register(
      'pushup',
      lazy(async () => ({ default: StubCounter }))
    );
    let delivered: number | null = null;
    await act(async () => {
      root.render(
        <ExerciseCounter
          exerciseKind="pushup"
          registry={registry}
          onComplete={(reps) => {
            delivered = reps;
          }}
        />
      );
    });
    await flush();
    const button = container.querySelector<HTMLButtonElement>('[aria-label="stub-complete"]');
    expect(button).not.toBeNull();
    await act(async () => {
      button!.click();
    });
    expect(delivered).toBe(7);
  });
});

describe('DefaultExerciseCounterRegistryFactory', () => {
  it('registers pushup out of the box', async () => {
    const { DefaultExerciseCounterRegistryFactory } =
      await import('../../apps/web/src/counters/DefaultExerciseCounterRegistryFactory.js');
    const registry = DefaultExerciseCounterRegistryFactory.create();
    expect(registry.has('pushup')).toBe(true);
    expect(registry.has('set')).toBe(false);
  });
});
