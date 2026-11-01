# apps/pushup-counter

Browser-based push-up counter. A rep is counted when the elbow angle drops below about 90 degrees and then returns to full extension, using MediaPipe Pose.

- **Status.** Stage 2, implemented. Not deployed.
- **Language.** TypeScript.
- **Runs where.** Entirely in the browser. Camera frames never leave the device.
- **Depends on.** `services/logging` for the final count only.
- **Events in.** None.
- **Events out.** None (posts the count via REST).

## Architecture

Two layers:

1. **`PushupRepCounter`** (`src/PushupRepCounter.ts`). Pure state machine.
   Accepts pose landmark frames and returns a monotonic rep count. No
   React, no camera, no model. Fully covered by `tests/pushup-counter/
PushupRepCounter.test.ts`.
2. **`PushupCounter`** (`src/PushupCounter.tsx`). React widget that
   wires a {@link PoseSource} to the rep counter. The default source
   is {@link MediaPipePoseSource}, which opens the user's camera via
   `getUserMedia` and runs `@mediapipe/tasks-vision` locally. Tests
   inject a scripted source so no browser peripherals are touched.

The widget exposes two callbacks:

- `onComplete(count)` is fired when the user clicks "Finish and log".
- `onError(err)` is fired when the pose source cannot start (camera
  denied, model download failed).

## Embedding

The widget is designed to drop into `apps/web/src/screens/LogWorkoutScreen.tsx`:

```tsx
import { PushupCounter } from '@gym/pushup-counter';

<PushupCounter
  onComplete={async (reps) => {
    await authorized.run((accessToken) =>
      loggingApi.logWorkout({
        request: { exerciseId: 'pushup', kind: 'pushup', reps },
        accessToken,
        idempotencyKey: newIdempotencyKey(),
      })
    );
  }}
/>;
```

Both PRs (`feat/web-shell` and `feat/pushup-counter`) target `main`.
The integration edit itself (adding the import to `LogWorkoutScreen`)
is a tiny follow-up PR that depends on both landing; it is listed in
`docs/overnight-report.md` as an owner follow-up.

## Scripts

```
pnpm --filter @gym/pushup-counter test       # Vitest under jsdom
pnpm --filter @gym/pushup-counter typecheck  # tsc --noEmit
pnpm --filter @gym/pushup-counter lint       # eslint src --max-warnings 0
```

## Tests

Live under `tests/pushup-counter/`. The pure counter is driven by
hand-authored landmark frames (`support/Frames.ts` builds a 33-slot
MediaPipe-shaped array around a parameterised elbow angle). The widget
tests use a `StubPoseSource` that replays a scripted frame sequence,
so the full React lifecycle runs without a camera or a MediaPipe
model download.

## Decisions made overnight

1. **Pure counter, injected pose source.** The counting logic lives in
   `PushupRepCounter`, a plain class with no DOM, camera or model
   dependency. The React widget owns the lifecycle but delegates
   every landmark to the counter. This split is what makes the state
   machine testable without MediaPipe in the test runner.
2. **Thresholds: down 90 degrees, up 160 degrees.** The 90 degree
   threshold matches `docs/architecture.md`. 160 degrees for "up"
   gives enough margin for a user who does not quite reach 180 at
   the top of each rep, without triggering a false rep when they
   wobble around 90.
3. **Pick the smaller elbow angle across the two arms.** The user is
   almost always offset from the camera, so one arm tracks better
   than the other. Using the smaller (more flexed) angle per frame
   improves recall without inflating the rep count: a rep still
   requires crossing both thresholds.
4. **MediaPipe loaded from the jsdelivr CDN.** The runtime WASM blob
   (~4 MB) and the vision model (~4 MB) are both served from
   jsdelivr and the official MediaPipe model bucket, so the project
   needs no CDN of its own. Zero recurring cost.
5. **`@mediapipe/tasks-vision` (not the older `@mediapipe/pose`).**
   Tasks-vision is the current MediaPipe JS surface, has a maintained
   TypeScript package, and uses the WASM pose landmarker. The older
   package is in maintenance mode and bundles an unmaintained
   `.binarypb` model format.
6. **Widget deferred-integrated with `apps/web`.** Both services
   target `main` in parallel PRs tonight. The glue edit in
   `LogWorkoutScreen` is a tiny follow-up PR listed in the overnight
   report so the owner's review order is explicit.

## Related

- Architecture: `docs/architecture.md`.
- Diagrams: `docs/uml/pushup-counter/`.
- Logging contract: `packages/contracts/src/api/logging.ts` (`kind: 'pushup'`).
