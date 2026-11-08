import type { CatalogueApi, LoggingApi } from '@gym/contracts';
import { useCallback, useEffect, useState } from 'react';

import { HttpError } from '../api/HttpError.js';
import { useAppDependencies } from '../app/AppContext.js';
import { ExerciseCounter } from '../counters/ExerciseCounter.js';

type Kind = LoggingApi.LogWorkoutRequest['kind'];

/**
 * `/log-workout` screen. Loads the first page of exercises from the
 * catalogue, lets the user pick one, enter reps / weight / duration,
 * and POSTs to the logging API with a client-generated idempotency
 * key so a double-tap on the submit button is safe.
 *
 * When the selected `kind` has an on-device counter registered in
 * {@link AppDependencies.exerciseCounters} (push-ups today), a
 * "Count with camera" control toggles the lazy-loaded
 * {@link ExerciseCounter}. The counter runs entirely in the browser;
 * only the final rep count hits {@link loggingApi.logWorkout}. The
 * manual rep form remains the primary path and is still available
 * if the user denies the camera or opts out.
 */
export function LogWorkoutScreen(): JSX.Element {
  const { authorized, catalogueApi, exerciseCounters, loggingApi, navigator, newIdempotencyKey } =
    useAppDependencies();

  const [exercises, setExercises] = useState<readonly CatalogueApi.Exercise[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState<boolean>(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState<string>('');
  const [kind, setKind] = useState<Kind>('set');
  const [reps, setReps] = useState<string>('10');
  const [weightKg, setWeightKg] = useState<string>('');
  const [durationSeconds, setDurationSeconds] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    catalogueApi
      .listExercises({ limit: 100 })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setExercises(response.exercises);
        if (response.exercises.length > 0 && exerciseId.length === 0) {
          setExerciseId(response.exercises[0]!.id);
        }
      })
      .catch((err: unknown) => {
        console.error(err);
        if (cancelled) {
          return;
        }
        setCatalogueError(
          err instanceof HttpError ? err.serverMessage : 'Could not load exercises.'
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCatalogue(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [catalogueApi, exerciseId.length]);

  const submitReps = useCallback(
    async (finalReps: number): Promise<void> => {
      const request: LoggingApi.LogWorkoutRequest = {
        exerciseId,
        kind,
        reps: finalReps,
      };
      setSubmitError(null);
      setSubmitting(true);
      try {
        await authorized.run((accessToken) =>
          loggingApi.logWorkout({ request, accessToken, idempotencyKey: newIdempotencyKey() })
        );
        navigator.navigate('/history');
      } catch (err) {
        console.error(err);
        setSubmitError(
          err instanceof HttpError && err.serverMessage.length > 0
            ? err.serverMessage
            : 'Could not log workout. Try again in a moment.'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [authorized, exerciseId, kind, loggingApi, navigator, newIdempotencyKey]
  );

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsedReps = Number.parseInt(reps, 10);
      if (!Number.isFinite(parsedReps) || parsedReps < 1) {
        setSubmitError('Reps must be a positive whole number.');
        return;
      }
      const request: LoggingApi.LogWorkoutRequest = {
        exerciseId,
        kind,
        reps: parsedReps,
      };
      if (weightKg.trim().length > 0) {
        const w = Number.parseFloat(weightKg);
        if (!Number.isFinite(w) || w < 0) {
          setSubmitError('Weight must be a non-negative number.');
          return;
        }
        Object.assign(request, { weightKg: w });
      }
      if (durationSeconds.trim().length > 0) {
        const d = Number.parseInt(durationSeconds, 10);
        if (!Number.isFinite(d) || d < 1) {
          setSubmitError('Duration must be a positive whole number of seconds.');
          return;
        }
        Object.assign(request, { durationSeconds: d });
      }
      setSubmitError(null);
      setSubmitting(true);
      try {
        await authorized.run((accessToken) =>
          loggingApi.logWorkout({ request, accessToken, idempotencyKey: newIdempotencyKey() })
        );
        navigator.navigate('/history');
      } catch (err) {
        console.error(err);
        setSubmitError(
          err instanceof HttpError && err.serverMessage.length > 0
            ? err.serverMessage
            : 'Could not log workout. Try again in a moment.'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      authorized,
      durationSeconds,
      exerciseId,
      kind,
      loggingApi,
      navigator,
      newIdempotencyKey,
      reps,
      weightKg,
    ]
  );

  const cameraAvailable = exerciseCounters.has(kind);

  return (
    <section aria-labelledby="log-workout-title">
      <h1 id="log-workout-title">Log a workout</h1>
      {loadingCatalogue ? <p role="status">Loading exercises...</p> : null}
      {catalogueError !== null ? (
        <p role="alert" className="form-error">
          {catalogueError}
        </p>
      ) : null}
      <form onSubmit={onSubmit} noValidate>
        <label>
          Exercise
          <select
            name="exercise"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            disabled={exercises.length === 0}
            required
          >
            {exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kind
          <select
            name="kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              setCameraOpen(false);
            }}
          >
            <option value="set">Set</option>
            <option value="pushup">Push-up count</option>
          </select>
        </label>
        {cameraAvailable && !cameraOpen ? (
          <button type="button" onClick={() => setCameraOpen(true)}>
            Count with camera
          </button>
        ) : null}
        <label>
          Reps
          <input
            type="number"
            name="reps"
            min={1}
            max={10000}
            step={1}
            required
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </label>
        {kind === 'set' ? (
          <label>
            Weight (kg, optional)
            <input
              type="number"
              name="weight"
              min={0}
              max={10000}
              step={0.5}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </label>
        ) : null}
        <label>
          Duration (seconds, optional)
          <input
            type="number"
            name="duration"
            min={1}
            max={86400}
            step={1}
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(e.target.value)}
          />
        </label>
        {submitError !== null ? (
          <p role="alert" className="form-error">
            {submitError}
          </p>
        ) : null}
        <button type="submit" disabled={submitting || exercises.length === 0}>
          {submitting ? 'Saving...' : 'Save workout'}
        </button>
      </form>
      {cameraAvailable && cameraOpen ? (
        <ExerciseCounter
          exerciseKind={kind}
          registry={exerciseCounters}
          onComplete={(finalReps) => {
            setCameraOpen(false);
            if (finalReps > 0) {
              setReps(String(finalReps));
              void submitReps(finalReps);
            }
          }}
          onCancel={() => setCameraOpen(false)}
        />
      ) : null}
    </section>
  );
}
