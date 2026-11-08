# `@gym/pose`

Pose primitives and generic rep-counting machinery.

Two entry points:

- `@gym/pose` (default): pure types (`PoseLandmark`, `PoseLandmarks`, `PoseLandmarkIndex`), geometry (`PoseGeometry`), the `PoseSource` interface, the `RepDetector` interface, and the generic `RepCounter`.
- `@gym/pose/browser`: `MediaPipePoseSource`, the browser adapter that drives a `<video>` element with MediaPipe Tasks Vision. Pulling in this subpath requires DOM typings.

The counter is deliberately exercise-agnostic. It owns the running total and the most recent observation; the detector owns the motion-specific state machine.

## Usage

```ts
import { RepCounter } from '@gym/pose';
import { PushupRepDetector } from '@gym/exercise-pushup';

const counter = new RepCounter(new PushupRepDetector());
counter.processFrame(landmarks);
console.log(counter.getCount());
```

Browser:

```ts
import { MediaPipePoseSource } from '@gym/pose/browser';

const source = new MediaPipePoseSource({ videoElement });
await source.start((landmarks) => counter.processFrame(landmarks));
```
