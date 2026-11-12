import { PoseLandmarkIndex, type PoseLandmark, type PoseLandmarks } from '../PoseLandmark.js';

/**
 * Size of the canvas being drawn into. Matches the browser
 * `HTMLCanvasElement` width/height pair but is declared locally so
 * tests can drive the renderer with a plain object and so the type
 * reads naturally in option signatures.
 */
export interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Render-time options.
 *
 * `mirrored` should be `true` whenever the renderer is drawing over a
 * user-facing camera that is being CSS-flipped (`transform: scaleX(-1)`)
 * so the skeleton tracks the on-screen video rather than the raw
 * normalised landmarks.
 */
export interface SkeletonRenderOptions {
  readonly mirrored: boolean;
}

/**
 * Appearance knobs for {@link SkeletonRenderer}. All colours are
 * strings accepted by the Canvas 2D context (`#rgb`, `rgba(...)`,
 * CSS names).
 */
export interface SkeletonRendererOptions {
  readonly lineWidth: number;
  readonly jointRadius: number;
  readonly goodColor: string;
  readonly lowConfidenceColor: string;
  readonly minVisibility: number;
}

const DEFAULTS: SkeletonRendererOptions = {
  lineWidth: 3,
  jointRadius: 4,
  goodColor: '#22c55e',
  lowConfidenceColor: '#94a3b8',
  minVisibility: 0.5,
};

/**
 * Pairs of landmark indices to draw as segments of the skeleton.
 * Keeps the arms, torso rectangle, and legs; omits the face so the
 * overlay reads at a glance.
 */
const SKELETON_EDGES: ReadonlyArray<readonly [PoseLandmarkIndex, PoseLandmarkIndex]> = [
  [PoseLandmarkIndex.LeftShoulder, PoseLandmarkIndex.RightShoulder],
  [PoseLandmarkIndex.LeftShoulder, PoseLandmarkIndex.LeftElbow],
  [PoseLandmarkIndex.LeftElbow, PoseLandmarkIndex.LeftWrist],
  [PoseLandmarkIndex.RightShoulder, PoseLandmarkIndex.RightElbow],
  [PoseLandmarkIndex.RightElbow, PoseLandmarkIndex.RightWrist],
  [PoseLandmarkIndex.LeftShoulder, PoseLandmarkIndex.LeftHip],
  [PoseLandmarkIndex.RightShoulder, PoseLandmarkIndex.RightHip],
  [PoseLandmarkIndex.LeftHip, PoseLandmarkIndex.RightHip],
  [PoseLandmarkIndex.LeftHip, PoseLandmarkIndex.LeftKnee],
  [PoseLandmarkIndex.LeftKnee, PoseLandmarkIndex.LeftAnkle],
  [PoseLandmarkIndex.RightHip, PoseLandmarkIndex.RightKnee],
  [PoseLandmarkIndex.RightKnee, PoseLandmarkIndex.RightAnkle],
];

const SKELETON_JOINTS: readonly PoseLandmarkIndex[] = [
  PoseLandmarkIndex.LeftShoulder,
  PoseLandmarkIndex.RightShoulder,
  PoseLandmarkIndex.LeftElbow,
  PoseLandmarkIndex.RightElbow,
  PoseLandmarkIndex.LeftWrist,
  PoseLandmarkIndex.RightWrist,
  PoseLandmarkIndex.LeftHip,
  PoseLandmarkIndex.RightHip,
  PoseLandmarkIndex.LeftKnee,
  PoseLandmarkIndex.RightKnee,
  PoseLandmarkIndex.LeftAnkle,
  PoseLandmarkIndex.RightAnkle,
];

/**
 * Draws a MediaPipe pose skeleton over a camera stream.
 *
 * Lives under `packages/pose/src/browser` so Node consumers never pull
 * the Canvas typings in. The renderer is stateless: the caller owns
 * the canvas element and passes the 2D context on every frame, so the
 * same instance can serve any number of canvases.
 */
export class SkeletonRenderer {
  private readonly options: SkeletonRendererOptions;

  public constructor(options: Partial<SkeletonRendererOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Clear the whole canvas. Call before every {@link render} pass. */
  public clear(context: CanvasRenderingContext2D, size: CanvasSize): void {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.restore();
  }

  /**
   * Draw the skeleton for a single pose frame.
   *
   * Segments whose endpoints both clear {@link SkeletonRendererOptions.minVisibility}
   * are drawn in `goodColor`; any segment with a low-confidence
   * endpoint is drawn in `lowConfidenceColor`. Joint markers follow
   * the same rule per landmark.
   */
  public render(
    context: CanvasRenderingContext2D,
    landmarks: PoseLandmarks,
    size: CanvasSize,
    options: SkeletonRenderOptions
  ): void {
    this.clear(context, size);
    context.save();
    if (options.mirrored) {
      context.setTransform(-1, 0, 0, 1, size.width, 0);
    }
    context.lineWidth = this.options.lineWidth;
    for (const [fromIndex, toIndex] of SKELETON_EDGES) {
      const from = landmarks[fromIndex];
      const to = landmarks[toIndex];
      if (from === undefined || to === undefined) {
        continue;
      }
      const confident = this.isConfident(from) && this.isConfident(to);
      context.strokeStyle = confident ? this.options.goodColor : this.options.lowConfidenceColor;
      context.beginPath();
      context.moveTo(from.x * size.width, from.y * size.height);
      context.lineTo(to.x * size.width, to.y * size.height);
      context.stroke();
    }
    for (const index of SKELETON_JOINTS) {
      const point = landmarks[index];
      if (point === undefined) {
        continue;
      }
      const confident = this.isConfident(point);
      context.fillStyle = confident ? this.options.goodColor : this.options.lowConfidenceColor;
      context.beginPath();
      context.arc(
        point.x * size.width,
        point.y * size.height,
        this.options.jointRadius,
        0,
        Math.PI * 2
      );
      context.fill();
    }
    context.restore();
  }

  private isConfident(landmark: PoseLandmark): boolean {
    const v = landmark.visibility ?? 1;
    return v >= this.options.minVisibility;
  }
}
