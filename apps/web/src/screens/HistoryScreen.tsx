import type { LoggingApi } from '@gym/contracts';
import { useCallback, useEffect, useState } from 'react';

import { HttpError } from '../api/HttpError.js';
import { useAppDependencies } from '../app/AppContext.js';

/**
 * `/history` screen. Loads the caller's workouts page by page from
 * the logging API and renders them newest first. Pagination is
 * cursor-based per the service contract.
 */
export function HistoryScreen(): JSX.Element {
  const { authorized, loggingApi } = useAppDependencies();
  const [workouts, setWorkouts] = useState<readonly LoggingApi.Workout[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextCursor: string | null): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const response = await authorized.run((accessToken) =>
          loggingApi.listWorkouts({
            accessToken,
            limit: 20,
            ...(nextCursor !== null ? { cursor: nextCursor } : {}),
          })
        );
        setWorkouts((prev) =>
          nextCursor === null ? response.workouts : [...prev, ...response.workouts]
        );
        setCursor(response.cursor ?? null);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof HttpError && err.serverMessage.length > 0
            ? err.serverMessage
            : 'Could not load history.'
        );
      } finally {
        setLoading(false);
      }
    },
    [authorized, loggingApi]
  );

  useEffect(() => {
    void loadPage(null);
  }, [loadPage]);

  return (
    <section aria-labelledby="history-title">
      <h1 id="history-title">Workout history</h1>
      {error !== null ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {workouts.length === 0 && !loading && error === null ? <p>No workouts logged yet.</p> : null}
      <ul className="workout-list">
        {workouts.map((workout) => (
          <li key={workout.workoutId}>
            <time dateTime={workout.loggedAt}>{formatTimestamp(workout.loggedAt)}</time>
            <span className="exercise-id">{workout.exerciseId}</span>
            <span className="kind">{workout.kind}</span>
            <span>{workout.reps} reps</span>
            {workout.weightKg !== undefined ? <span>{workout.weightKg} kg</span> : null}
            {workout.durationSeconds !== undefined ? <span>{workout.durationSeconds}s</span> : null}
          </li>
        ))}
      </ul>
      {cursor !== null ? (
        <button type="button" disabled={loading} onClick={() => void loadPage(cursor)}>
          {loading ? 'Loading...' : 'Load more'}
        </button>
      ) : null}
    </section>
  );
}

function formatTimestamp(isoUtc: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) {
    return isoUtc;
  }
  return d.toLocaleString();
}
