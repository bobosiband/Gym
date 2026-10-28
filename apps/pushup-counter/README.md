# apps/pushup-counter

Browser-based push-up counter. A rep is counted when the elbow angle drops below about 90 degrees and then returns to full extension, using MediaPipe Pose.

- **Status.** Scaffold only. Implementation lands in Stage 2.
- **Proposed language.** TypeScript (pending owner approval).
- **Runs where.** Entirely in the browser. Camera frames never leave the device.
- **Depends on.** `services/logging` for the final count only.
- **Events in.** None.
- **Events out.** None (posts the count via REST).

See `docs/architecture.md` for context.
