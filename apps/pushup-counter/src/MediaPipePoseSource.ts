import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';

import type { PoseFrameListener, PoseSource } from './PoseSource.js';

/**
 * Construction options for {@link MediaPipePoseSource}.
 *
 * The defaults point at the official MediaPipe CDN so the demo and
 * the embedded widget work out of the box with no additional
 * hosting. The vision model (`pose_landmarker_lite.task`) weighs ~4
 * MB and is cached by the browser once downloaded.
 */
export interface MediaPipePoseSourceOptions {
  readonly wasmBaseUrl: string;
  readonly modelAssetUrl: string;
  readonly videoElement: HTMLVideoElement;
}

const DEFAULT_WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm';
const DEFAULT_MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

/**
 * MediaPipe-backed implementation of {@link PoseSource}. Opens the
 * user's camera via `getUserMedia`, feeds every video frame through
 * the pose landmarker, and emits normalised landmarks to the
 * listener. The camera stream is never routed through the network;
 * all inference happens in-browser via a WASM runtime.
 *
 * This class is excluded from the Vitest run (the matching test file
 * uses a scripted stub instead) because wiring the full WASM + camera
 * stack in jsdom is not useful: the counting logic lives in
 * {@link PushupRepCounter}, which is fully tested in isolation.
 */
type DefaultOptions = Pick<MediaPipePoseSourceOptions, 'wasmBaseUrl' | 'modelAssetUrl'>;

export class MediaPipePoseSource implements PoseSource {
  public static readonly defaults: DefaultOptions = {
    wasmBaseUrl: DEFAULT_WASM_BASE_URL,
    modelAssetUrl: DEFAULT_MODEL_ASSET_URL,
  };

  private readonly options: MediaPipePoseSourceOptions;
  private landmarker: PoseLandmarker | null = null;
  private mediaStream: MediaStream | null = null;
  private rafHandle: number | null = null;
  private running: boolean = false;

  public constructor(
    options: Partial<MediaPipePoseSourceOptions> & { videoElement: HTMLVideoElement }
  ) {
    this.options = {
      wasmBaseUrl: options.wasmBaseUrl ?? DEFAULT_WASM_BASE_URL,
      modelAssetUrl: options.modelAssetUrl ?? DEFAULT_MODEL_ASSET_URL,
      videoElement: options.videoElement,
    };
  }

  public async start(listener: PoseFrameListener): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    const fileset = await FilesetResolver.forVisionTasks(this.options.wasmBaseUrl);
    this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: this.options.modelAssetUrl },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
    const video = this.options.videoElement;
    video.srcObject = this.mediaStream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    const loop = (timestampMs: number): void => {
      if (!this.running || this.landmarker === null) {
        return;
      }
      const result: PoseLandmarkerResult = this.landmarker.detectForVideo(video, timestampMs);
      const firstPose = result.landmarks[0];
      if (firstPose !== undefined) {
        listener(firstPose);
      }
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  public async stop(): Promise<void> {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.landmarker !== null) {
      this.landmarker.close();
      this.landmarker = null;
    }
    if (this.mediaStream !== null) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    const video = this.options.videoElement;
    video.pause();
    video.srcObject = null;
  }
}
