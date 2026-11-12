import { RepCounter } from '@gym/pose';
import type { PoseLandmarks, PoseSource } from '@gym/pose';
import { MediaPipePoseSource, SkeletonRenderer } from '@gym/pose/browser';
import { PostureGate, StrictPushupRepDetector } from '@gym/exercise-pushup';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ExerciseCounterProps } from './ExerciseCounterComponent.js';

type Status = 'idle' | 'starting' | 'running' | 'stopped' | 'error';
type Phase = 'unknown' | 'up' | 'down' | 'pause';

/**
 * Push-up counter widget. Composes a {@link MediaPipePoseSource}
 * (browser-only; pulls in the MediaPipe WASM runtime the first time
 * the module is imported) with the generic {@link RepCounter} and
 * the {@link StrictPushupRepDetector} strategy.
 *
 * The widget draws a mirrored skeleton overlay on top of the camera
 * feed so the user can see what the detector sees. Posture, phase,
 * and the current elbow angle are shown in text alongside the rep
 * count. A posture-aware live region announces transitions in and
 * out of the push-up position.
 */
export default function PushupExerciseCounter(props: ExerciseCounterProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceRef = useRef<PoseSource | null>(null);
  const counterRef = useRef<RepCounter>(new RepCounter(new StrictPushupRepDetector()));
  const rendererRef = useRef<SkeletonRenderer>(new SkeletonRenderer());
  const postureGateRef = useRef<PostureGate>(new PostureGate());
  const [status, setStatus] = useState<Status>('idle');
  const [count, setCount] = useState<number>(0);
  const [angle, setAngle] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('unknown');
  const [inPosition, setInPosition] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFrame = useCallback((landmarks: PoseLandmarks) => {
    counterRef.current.processFrame(landmarks);
    setCount(counterRef.current.getCount());
    const observation = counterRef.current.getLastObservation();
    setAngle(observation?.signalValue ?? null);
    setPhase((observation?.phaseLabel as Phase | undefined) ?? 'unknown');
    setInPosition(postureGateRef.current.evaluate(landmarks).inPosition);
    drawOverlay(canvasRef.current, videoRef.current, rendererRef.current, landmarks);
  }, []);

  const start = useCallback(async () => {
    if (videoRef.current === null) {
      return;
    }
    counterRef.current.reset();
    setCount(0);
    setAngle(null);
    setPhase('unknown');
    setInPosition(false);
    setErrorMessage(null);
    setStatus('starting');
    try {
      const source = new MediaPipePoseSource({ videoElement: videoRef.current });
      sourceRef.current = source;
      await source.start(handleFrame);
      setStatus('running');
    } catch (err) {
      setStatus('error');
      const message = resolveCameraErrorMessage(err);
      setErrorMessage(message);
      props.onError?.(err);
    }
  }, [handleFrame, props]);

  const finish = useCallback(async () => {
    const source = sourceRef.current;
    sourceRef.current = null;
    if (source !== null) {
      await source.stop();
    }
    setStatus('stopped');
    props.onComplete(counterRef.current.getCount());
  }, [props]);

  const cancel = useCallback(async () => {
    const source = sourceRef.current;
    sourceRef.current = null;
    if (source !== null) {
      await source.stop();
    }
    setStatus('idle');
    props.onCancel?.();
  }, [props]);

  useEffect(() => {
    return () => {
      void sourceRef.current?.stop();
    };
  }, []);

  const postureLabel = inPosition ? 'In position' : 'Get into position';

  return (
    <section aria-labelledby="exercise-counter-title" className="exercise-counter">
      <h2 id="exercise-counter-title">Push-up counter</h2>
      <p className="exercise-counter-stats">
        <strong aria-label="rep count">{count}</strong> reps
        {angle !== null ? (
          <span className="exercise-counter-signal"> | elbow {Math.round(angle)} degrees</span>
        ) : null}
        <span className="exercise-counter-signal"> | phase {phase}</span>
      </p>
      <p
        role="status"
        aria-live="polite"
        className={`exercise-counter-posture exercise-counter-posture-${inPosition ? 'ok' : 'warn'}`}
      >
        {postureLabel}
      </p>
      <div className="exercise-counter-stage">
        <video ref={videoRef} className="exercise-counter-video" playsInline muted />
        <canvas ref={canvasRef} className="exercise-counter-overlay" aria-hidden="true" />
      </div>
      <div className="exercise-counter-actions">
        {status === 'idle' || status === 'stopped' || status === 'error' ? (
          <button type="button" onClick={start}>
            {status === 'stopped' ? 'Start new session' : 'Start camera'}
          </button>
        ) : null}
        {status === 'starting' ? <span role="status">Loading model...</span> : null}
        {status === 'running' ? (
          <>
            <button type="button" onClick={finish}>
              Finish and log
            </button>
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          </>
        ) : null}
      </div>
      {errorMessage !== null ? (
        <p role="alert" className="form-error">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Draw the skeleton overlay for a single frame. Pulled out of the
 * component body so the hook stays small and the renderer call site
 * does not pollute the state-management code.
 */
function drawOverlay(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement | null,
  renderer: SkeletonRenderer,
  landmarks: PoseLandmarks
): void {
  if (canvas === null || video === null) {
    return;
  }
  const width = video.videoWidth || video.clientWidth;
  const height = video.videoHeight || video.clientHeight;
  if (width === 0 || height === 0) {
    return;
  }
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
  const context = canvas.getContext('2d');
  if (context === null) {
    return;
  }
  renderer.render(context, landmarks, { width, height }, { mirrored: true });
}

/**
 * Produce a user-facing message for a `getUserMedia` or MediaPipe
 * failure. The browser's own `error.message` is usually "Permission
 * denied" or "Requested device not found"; those are fine but a
 * `NotAllowedError` on iOS Safari sometimes carries an empty
 * message, so we surface the error name too.
 */
function resolveCameraErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'NotAllowedError') {
      return 'Camera permission was denied. Allow camera access in your browser settings and try again.';
    }
    if (err.name === 'NotFoundError') {
      return 'No camera was found on this device. Log push-ups manually below.';
    }
    if (err.name === 'NotReadableError') {
      return 'The camera is being used by another app. Close it and try again.';
    }
    return err.message.length > 0 ? err.message : 'Could not start the camera.';
  }
  return 'Could not start the camera.';
}
