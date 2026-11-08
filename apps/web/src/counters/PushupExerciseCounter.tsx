import { RepCounter } from '@gym/pose';
import type { PoseSource } from '@gym/pose';
import { MediaPipePoseSource } from '@gym/pose/browser';
import { PushupRepDetector } from '@gym/exercise-pushup';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ExerciseCounterProps } from './ExerciseCounterComponent.js';

type Status = 'idle' | 'starting' | 'running' | 'stopped' | 'error';

/**
 * Push-up counter widget. Composes a {@link MediaPipePoseSource}
 * (browser-only; pulls in the MediaPipe WASM runtime the first time
 * the module is imported) with the generic {@link RepCounter} and
 * the {@link PushupRepDetector} strategy.
 *
 * The widget is intentionally thin: camera is acquired on Start,
 * released on Finish or unmount, and the running count flows out
 * through {@link ExerciseCounterProps.onComplete}. The host screen
 * is responsible for POSTing the final count.
 *
 * Camera-denied flows: `getUserMedia` rejections are surfaced via
 * the `onError` prop. The widget also renders the error text so the
 * user sees a plain-language reason without the host having to
 * wire another banner.
 */
export default function PushupExerciseCounter(props: ExerciseCounterProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sourceRef = useRef<PoseSource | null>(null);
  const counterRef = useRef<RepCounter>(new RepCounter(new PushupRepDetector()));
  const [status, setStatus] = useState<Status>('idle');
  const [count, setCount] = useState<number>(0);
  const [angle, setAngle] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (videoRef.current === null) {
      return;
    }
    counterRef.current.reset();
    setCount(0);
    setAngle(null);
    setErrorMessage(null);
    setStatus('starting');
    try {
      const source = new MediaPipePoseSource({ videoElement: videoRef.current });
      sourceRef.current = source;
      await source.start((landmarks) => {
        counterRef.current.processFrame(landmarks);
        setCount(counterRef.current.getCount());
        const observation = counterRef.current.getLastObservation();
        setAngle(observation?.signalValue ?? null);
      });
      setStatus('running');
    } catch (err) {
      setStatus('error');
      const message = resolveCameraErrorMessage(err);
      setErrorMessage(message);
      props.onError?.(err);
    }
  }, [props]);

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

  return (
    <section aria-labelledby="exercise-counter-title" className="exercise-counter">
      <h2 id="exercise-counter-title">Push-up counter</h2>
      <p className="exercise-counter-stats">
        <strong aria-label="rep count">{count}</strong> reps
        {angle !== null ? (
          <span className="exercise-counter-signal"> | elbow {Math.round(angle)} degrees</span>
        ) : null}
      </p>
      <video ref={videoRef} className="exercise-counter-video" playsInline muted />
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
