import { RepCounter } from '@gym/pose';
import type { PoseLandmarks, PoseSource } from '@gym/pose';
import { MediaPipePoseSource, SkeletonRenderer } from '@gym/pose/browser';
import { StrictPushupRepDetector } from '@gym/exercise-pushup';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ExerciseCounterProps } from './ExerciseCounterComponent.js';

type Status = 'idle' | 'starting' | 'running' | 'stopped' | 'error';
type Phase = 'unknown' | 'up' | 'down' | 'pause' | 'dropout';
type View = 'front' | 'side' | 'unknown';

/**
 * Push-up counter widget. Composes a {@link MediaPipePoseSource}
 * (browser-only; pulls in the MediaPipe WASM runtime the first time
 * the module is imported) with the generic {@link RepCounter} and
 * the {@link StrictPushupRepDetector} strategy.
 *
 * The widget draws a mirrored skeleton overlay on top of the camera
 * feed so the user can see what the detector sees. Posture, phase,
 * detected view, and the current elbow angle are shown in text
 * alongside the rep count; the failReason of the latest frame is
 * surfaced inside the posture-aware live region so screen readers
 * announce "wrists not below shoulders" and friends.
 */
export default function PushupExerciseCounter(props: ExerciseCounterProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceRef = useRef<PoseSource | null>(null);
  const counterRef = useRef<RepCounter>(new RepCounter(new StrictPushupRepDetector()));
  const rendererRef = useRef<SkeletonRenderer>(new SkeletonRenderer());
  const [status, setStatus] = useState<Status>('idle');
  const [count, setCount] = useState<number>(0);
  const [angle, setAngle] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('unknown');
  const [view, setView] = useState<View>('unknown');
  const [failReason, setFailReason] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFrame = useCallback((landmarks: PoseLandmarks) => {
    drawOverlay(canvasRef.current, videoRef.current, rendererRef.current, landmarks);
    counterRef.current.processFrame(landmarks);
    setCount(counterRef.current.getCount());
    const observation = counterRef.current.getLastObservation();
    setAngle(observation?.signalValue ?? null);
    setPhase((observation?.phaseLabel as Phase | undefined) ?? 'unknown');
    setView((observation?.view as View | undefined) ?? 'unknown');
    setFailReason(observation?.failReason ?? null);
  }, []);

  const start = useCallback(async () => {
    if (videoRef.current === null) {
      return;
    }
    counterRef.current.reset();
    setCount(0);
    setAngle(null);
    setPhase('unknown');
    setView('unknown');
    setFailReason(null);
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

  const inPosition = phase === 'up' || phase === 'down' || phase === 'dropout';
  const feedback = resolveFeedback(inPosition, failReason);
  const setupHint =
    status === 'idle' || status === 'starting'
      ? 'Place your phone on the floor in front of you, about an arm’s length away, so your head, shoulders and arms are in view.'
      : null;

  return (
    <section aria-labelledby="exercise-counter-title" className="exercise-counter">
      <h2 id="exercise-counter-title">Push-up counter</h2>
      {setupHint !== null ? <p className="exercise-counter-setup-hint">{setupHint}</p> : null}
      <p className="exercise-counter-stats">
        <strong aria-label="rep count">{count}</strong> reps
        {angle !== null ? (
          <span className="exercise-counter-signal"> | signal {angle.toFixed(2)}</span>
        ) : null}
        <span className="exercise-counter-signal"> | phase {phase}</span>
        <span className="exercise-counter-signal"> | view {view}</span>
      </p>
      <p
        role="status"
        aria-live="polite"
        className={`exercise-counter-posture exercise-counter-posture-${feedback.level}`}
      >
        {feedback.message}
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
 * Draw the skeleton overlay for a single frame. Called before any
 * state change so the overlay keeps rendering even when the detector
 * pauses or reports a landmark dropout.
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

interface Feedback {
  readonly level: 'ok' | 'warn' | 'info';
  readonly message: string;
}

/**
 * Translate the detector's `failReason` plus the current posture state
 * into the user-facing status line. Pairs the short, concrete tags
 * from {@link StrictPushupRepDetector} ("go lower", "lock out at the
 * top", "rep timing out of range") with full English sentences the
 * user can act on, so a rejected rep is never silent.
 */
function resolveFeedback(inPosition: boolean, failReason: string | null): Feedback {
  if (!inPosition) {
    if (failReason !== null) {
      return { level: 'warn', message: `Get into position (${failReason})` };
    }
    return { level: 'warn', message: 'Get into position' };
  }
  if (failReason === 'go lower') {
    return { level: 'info', message: 'Go lower' };
  }
  if (failReason === 'lock out at the top') {
    return { level: 'info', message: 'Lock out at the top' };
  }
  if (failReason === 'rep timing out of range') {
    return { level: 'info', message: 'Slow the rep down a touch' };
  }
  return { level: 'ok', message: 'In position' };
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
