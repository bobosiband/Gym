import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PushupCounter } from '../../apps/pushup-counter/src/PushupCounter.js';
import { armFrameAtAngle } from './support/Frames.js';
import { StubPoseSource } from './support/StubPoseSource.js';

let container: HTMLDivElement;
let root: Root;

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function click(selector: string): Promise<void> {
  const el = container.querySelector<HTMLButtonElement>(selector);
  if (el === null) {
    throw new Error(`click: no element matching ${selector}`);
  }
  await act(async () => {
    el.click();
  });
}

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

describe('PushupCounter widget', () => {
  it('starts the pose source and counts reps from the stubbed stream', async () => {
    const source = new StubPoseSource([
      armFrameAtAngle(170),
      armFrameAtAngle(85),
      armFrameAtAngle(170),
      armFrameAtAngle(85),
      armFrameAtAngle(170),
    ]);
    let delivered: number | null = null;
    await act(async () => {
      root.render(
        <PushupCounter
          onComplete={(count) => {
            delivered = count;
          }}
          createSource={() => source}
        />
      );
    });
    await click('button');
    await flush();
    expect(source.started).toBe(true);
    const counter = container.querySelector('[aria-label="rep count"]');
    expect(counter?.textContent).toBe('2');
    await click('button');
    await flush();
    expect(source.stopped).toBe(true);
    expect(delivered).toBe(2);
  });

  it('surfaces an error from the pose source', async () => {
    const failing = {
      started: false,
      stopped: false,
      async start(): Promise<void> {
        throw new Error('camera denied');
      },
      async stop(): Promise<void> {
        return;
      },
    };
    await act(async () => {
      root.render(<PushupCounter onComplete={() => undefined} createSource={() => failing} />);
    });
    await click('button');
    await flush();
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('camera denied');
  });
});
