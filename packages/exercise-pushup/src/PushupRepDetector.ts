import {
  PoseGeometry,
  PoseLandmarkIndex,
  type PoseLandmarks,
  type RepDetector,
  type RepObservation,
} from '@gym/pose';

/**
 * Tunable thresholds for the push-up detector. Defaults match the
 * project rule in `docs/architecture.md`: a rep is counted when the
 * elbow angle drops below about 90 degrees and returns to full
 * extension.
 */
export interface PushupRepDetectorOptions {
  readonly downAngleDegrees: number;
  readonly upAngleDegrees: number;
  readonly minVisibility: number;
}

const DEFAULTS: PushupRepDetectorOptions = {
  downAngleDegrees: 90,
  upAngleDegrees: 160,
  minVisibility: 0.5,
};

type Phase = 'unknown' | 'up' | 'down';

/**
 * Push-up rep detector. Owns the motion state machine but no count;
 * counting is done by the generic {@link RepCounter} that sits on
 * top of this detector.
 *
 * A rep is produced when the elbow angle crosses the "down"
 * threshold and later crosses back above the "up" threshold. Frames
 * with low visibility or missing landmarks are skipped so a dropped
 * frame does not reset the phase.
 *
 * The detector uses the arm (left or right) with the smaller
 * measured angle on each frame to improve recall for off-axis
 * camera placement.
 */
export class PushupRepDetector implements RepDetector {
  private readonly options: PushupRepDetectorOptions;
  private phase: Phase = 'unknown';

  public constructor(options: Partial<PushupRepDetectorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  public reset(): void {
    this.phase = 'unknown';
  }

  public processFrame(landmarks: PoseLandmarks): RepObservation {
    const angle = this.pickElbowAngle(landmarks);
    if (angle === null) {
      return { repCompleted: false, phaseLabel: this.phase };
    }
    if (angle <= this.options.downAngleDegrees) {
      this.phase = 'down';
      return { repCompleted: false, phaseLabel: 'down', signalValue: angle };
    }
    if (angle >= this.options.upAngleDegrees) {
      const wasDown = this.phase === 'down';
      this.phase = 'up';
      return { repCompleted: wasDown, phaseLabel: 'up', signalValue: angle };
    }
    return { repCompleted: false, phaseLabel: this.phase, signalValue: angle };
  }

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
    return PoseGeometry.jointAngleDegrees(shoulder, elbow, wrist);
  }
}
