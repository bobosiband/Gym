import { useCallback, useEffect, useRef, useState } from 'react';
import { RepCounter, type PoseSource } from '@gym/pose';
import { MediaPipePoseSource } from '@gym/pose/browser';
import { PushupRepDetector } from '@gym/exercise-pushup';

/**
 * Props for {@link PushupCounter}.
 *
 * `createSource` is injected for tests: production callers omit it
 * and the widget constructs a {@link MediaPipePoseSource} against
 * its internal `<video>` element.
 */
export interface PushupCounterProps {
  readonly onReady?: () => void;
  readonly onError?: (error: unknown) => void;
  readonly onComplete: (count: number) => void;
  readonly createSource?: (video: HTMLVideoElement) => PoseSource;
}

type Status = 'idle' | 'starting' | 'running' | 'stopped' | 'error';

/**
 * React widget that owns the camera, the pose source, and the rep
 * counter. Wired to a {@link PushupRepDetector} today; Stage 3 adds
 * a generic exercise-embed widget in `apps/web` that composes any
 * registered {@link Exercise}'s detector with the same
 * {@link RepCounter} machinery.
 *
 * The camera stream and inference stay local to the browser. The
 * parent only ever receives the final rep count.
 */
export function PushupCounter(props: PushupCounterProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sourceRef = useRef<PoseSource | null>(null);
  const counterRef = useRef<RepCounter>(new RepCounter(new PushupRepDetector()));
  const [status, setStatus] = useState<Status>('idle');
  const [count, setCount] = useState<number>(0);
  const [angle, setAngle] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createSource = useCallback(
    (video: HTMLVideoElement): PoseSource =>
      props.createSource !== undefined
        ? props.createSource(video)
        : new MediaPipePoseSource({ videoElement: video }),
    [props]
  );

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
      const source = createSource(videoRef.current);
      sourceRef.current = source;
      await source.start((landmarks) => {
        counterRef.current.processFrame(landmarks);
        setCount(counterRef.current.getCount());
        const observation = counterRef.current.getLastObservation();
        setAngle(observation?.signalValue ?? null);
      });
      setStatus('running');
      props.onReady?.();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Could not start the counter.');
      props.onError?.(err);
    }
  }, [createSource, props]);

  const finish = useCallback(async () => {
    const source = sourceRef.current;
    sourceRef.current = null;
    if (source !== null) {
      await source.stop();
    }
    setStatus('stopped');
    props.onComplete(counterRef.current.getCount());
  }, [props]);

  useEffect(() => {
    return () => {
      void sourceRef.current?.stop();
    };
  }, []);

  return (
    <section aria-labelledby="pushup-title" className="pushup-counter">
      <h2 id="pushup-title">Push-up counter</h2>
      <p className="pushup-stats">
        <strong aria-label="rep count">{count}</strong> reps
        {angle !== null ? (
          <span className="pushup-angle"> | elbow {Math.round(angle)} degrees</span>
        ) : null}
      </p>
      <video ref={videoRef} className="pushup-video" playsInline muted />
      <div className="pushup-actions">
        {status === 'idle' || status === 'stopped' || status === 'error' ? (
          <button type="button" onClick={start}>
            {status === 'stopped' ? 'Start new session' : 'Start'}
          </button>
        ) : null}
        {status === 'starting' ? <span role="status">Loading model...</span> : null}
        {status === 'running' ? (
          <button type="button" onClick={finish}>
            Finish and log
          </button>
        ) : null}
      </div>
      {errorMessage !== null ? (
        <p role="alert" className="pushup-error">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
