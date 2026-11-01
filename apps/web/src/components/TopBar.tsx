import { useCallback } from 'react';

import { useAppDependencies } from '../app/AppContext.js';

/**
 * Props for {@link TopBar}.
 */
export interface TopBarProps {
  readonly hasSession: boolean;
}

/**
 * Sticky top navigation. Shows the brand, a small nav for logged-in
 * users and a logout button; otherwise the user sees only the brand
 * and a login link.
 */
export function TopBar(props: TopBarProps): JSX.Element {
  const { navigator, session } = useAppDependencies();

  const go = useCallback(
    (path: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      navigator.navigate(path);
    },
    [navigator]
  );

  const onLogout = useCallback(async () => {
    await session.logout();
  }, [session]);

  return (
    <header className="top-bar">
      <a className="brand" href="/" onClick={go('/')}>
        Gym
      </a>
      <nav className="top-nav">
        {props.hasSession ? (
          <>
            <a href="/log-workout" onClick={go('/log-workout')}>
              Log workout
            </a>
            <a href="/history" onClick={go('/history')}>
              History
            </a>
            <button type="button" onClick={onLogout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <a href="/login" onClick={go('/login')}>
              Log in
            </a>
            <a href="/register" onClick={go('/register')}>
              Sign up
            </a>
          </>
        )}
      </nav>
    </header>
  );
}
