import type { PoseFrameListener, PoseSource } from '../../../apps/pushup-counter/src/PoseSource.js';
import type { PoseLandmarks } from '../../../apps/pushup-counter/src/PoseLandmark.js';

/**
 * In-memory {@link PoseSource} that replays a scripted sequence of
 * landmark frames. Tests use this to drive the push-up widget without
 * touching MediaPipe or a camera.
 */
export class StubPoseSource implements PoseSource {
  private readonly frames: readonly PoseLandmarks[];
  public started: boolean = false;
  public stopped: boolean = false;
  private listener: PoseFrameListener | null = null;

  public constructor(frames: readonly PoseLandmarks[]) {
    this.frames = frames;
  }

  public async start(listener: PoseFrameListener): Promise<void> {
    this.started = true;
    this.listener = listener;
    for (const frame of this.frames) {
      listener(frame);
    }
  }

  public async stop(): Promise<void> {
    this.stopped = true;
    this.listener = null;
  }

  /**
   * Deliver an additional frame to the running listener. Useful for
   * tests that assert on behaviour between `start()` and `stop()`.
   */
  public emit(frame: PoseLandmarks): void {
    this.listener?.(frame);
  }
}
