# tests/pushup-counter

Vitest suite for `apps/pushup-counter`. Camera and MediaPipe are never touched: tests feed hand-authored landmark sequences into `PushupRepCounter` and `PushupCounter` through a scripted `PoseSource` stub.

## Covered

- `ElbowAngle.test.ts`: geometry (straight arm = 180, bent elbow at 90, degenerate inputs).
- `PushupRepCounter.test.ts`: single rep, two reps, no spurious count when the user never reaches full extension, resumes mid-descent, visibility filter, reset.
- `PushupCounter.test.tsx`: widget renders, start/finish buttons appear at the right time, `onComplete` is called with the final rep count driven by a scripted pose source.

Run from the repo root:

```
pnpm --filter @gym/pushup-counter test
```
