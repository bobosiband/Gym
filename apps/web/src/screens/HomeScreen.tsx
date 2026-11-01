import { useCallback } from 'react';

import { useAppDependencies } from '../app/AppContext.js';

/**
 * Logged-in landing screen. Points the user at the two things the
 * PWA shell can do today: log a workout and review history. The
 * push-up counter lives in `apps/pushup-counter`; from the shell's
 * perspective it is reached via the same log-workout flow and the
 * component is embedded by that screen when the user picks the
 * push-up kind.
 */
export function HomeScreen(): JSX.Element {
  const { navigator } = useAppDependencies();

  const go = useCallback(
    (path: string) => () => {
      navigator.navigate(path);
    },
    [navigator]
  );

  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title">Welcome back</h1>
      <p>Pick what to do next.</p>
      <div className="home-actions">
        <button type="button" onClick={go('/log-workout')}>
          Log a workout
        </button>
        <button type="button" onClick={go('/history')}>
          View history
        </button>
      </div>
    </section>
  );
}
