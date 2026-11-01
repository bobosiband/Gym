import { ElbowAngle } from './ElbowAngle.js';
import { PoseLandmarkIndex, type PoseLandmarks } from './PoseLandmark.js';

/**
 * Tunable thresholds for the push-up state machine. Defaults match
 * the project rule in `docs/architecture.md`: "a rep is counted when
 * the elbow angle drops below about 90 degrees and returns to full
 * extension".
 */
export interface PushupRepCounterOptions {
  readonly downAngleDegrees: number;
  readonly upAngleDegrees: number;
  readonly minVisibility: number;
}

const DEFAULTS: PushupRepCounterOptions = {
  downAngleDegrees: 90,
  upAngleDegrees: 160,
  minVisibility: 0.5,
};

/**
 * Phase of the push-up motion inferred from the elbow angle.
 */
export type PushupPhase = 'unknown' | 'up' | 'down';

/**
 * Pure state machine that converts a stream of pose-landmark frames
 * into a push-up count. The counter is deliberately decoupled from
 * MediaPipe so tests can feed it hand-authored landmark sequences
 * and so the UI can swap pose estimators later without touching the
 * counting logic.
 *
 * A rep increments when the elbow angle crosses the "down" threshold
 * and then returns above the "up" threshold. Frames with low
 * visibility or missing landmarks are skipped: a dropped frame does
 * not reset the phase.
 *
 * The counter uses the arm (left or right) with the higher visibility
 * on each frame. In practice the camera is usually offset so one arm
 * is more reliably tracked than the other; picking the better arm per
 * frame improves recall without inflating the rep count.
 */
export class PushupRepCounter {
  private readonly options: PushupRepCounterOptions;
  private phase: PushupPhase = 'unknown';
  private count: number = 0;
  private lastElbowAngle: number | null = null;

  public constructor(options: Partial<PushupRepCounterOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Number of completed reps so far. */
  public getCount(): number {
    return this.count;
  }

  /** Current inferred phase of the motion. */
  public getPhase(): PushupPhase {
    return this.phase;
  }

  /** Most recent elbow angle (degrees), or `null` if none processed. */
  public getLastElbowAngle(): number | null {
    return this.lastElbowAngle;
  }

  /**
   * Reset the counter to its initial state. The thresholds survive
   * so a session can be restarted mid-workout without reconstructing
   * the instance.
   */
  public reset(): void {
    this.phase = 'unknown';
    this.count = 0;
    this.lastElbowAngle = null;
  }

  /**
   * Feed a frame of landmarks. Returns `true` if a new rep was
   * completed on this frame, `false` otherwise. The caller does not
   * have to observe the return value: {@link getCount} is always
   * up-to-date.
   */
  public processFrame(landmarks: PoseLandmarks): boolean {
    const angle = this.pickElbowAngle(landmarks);
    if (angle === null) {
      return false;
    }
    this.lastElbowAngle = angle;
    if (angle <= this.options.downAngleDegrees) {
      this.phase = 'down';
      return false;
    }
    if (angle >= this.options.upAngleDegrees) {
      const wasDown = this.phase === 'down';
      this.phase = 'up';
      if (wasDown) {
        this.count += 1;
        return true;
      }
    }
    return false;
  }

  /**
   * Return the smaller (more flexed) elbow angle across the left and
   * right arms. Arms with insufficient visibility are ignored.
   */
  private pickElbowAngle(landmarks: PoseLandmarks): number | null {
    const left = this.measureArm(
      landmarks,
      PoseLandmarkIndex.LeftShoulder,
      PoseLandmarkIndex.LeftElbow,
      PoseLandmarkIndex.LeftWrist
    );
    const right = this.measureArm(
      landmarks,
      PoseLandmarkIndex.RightShoulder,
      PoseLandmarkIndex.RightElbow,
      PoseLandmarkIndex.RightWrist
    );
    if (left === null && right === null) {
      return null;
    }
    if (left === null) {
      return right;
    }
    if (right === null) {
      return left;
    }
    return Math.min(left, right);
  }

  private measureArm(
    landmarks: PoseLandmarks,
    shoulderIndex: number,
    elbowIndex: number,
    wristIndex: number
  ): number | null {
    const shoulder = landmarks[shoulderIndex];
    const elbow = landmarks[elbowIndex];
    const wrist = landmarks[wristIndex];
    if (shoulder === undefined || elbow === undefined || wrist === undefined) {
      return null;
    }
    const minVis = this.options.minVisibility;
    const sVis = shoulder.visibility ?? 1;
    const eVis = elbow.visibility ?? 1;
    const wVis = wrist.visibility ?? 1;
    if (sVis < minVis || eVis < minVis || wVis < minVis) {
      return null;
    }
    return ElbowAngle.betweenShoulderElbowWrist(shoulder, elbow, wrist);
  }
}
