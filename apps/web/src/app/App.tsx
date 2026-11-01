import { useCallback, useEffect, useMemo, useState } from 'react';

import { TopBar } from '../components/TopBar.js';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen.js';
import { HistoryScreen } from '../screens/HistoryScreen.js';
import { HomeScreen } from '../screens/HomeScreen.js';
import { LogWorkoutScreen } from '../screens/LogWorkoutScreen.js';
import { LoginScreen } from '../screens/LoginScreen.js';
import { NotFoundScreen } from '../screens/NotFoundScreen.js';
import { RegisterScreen } from '../screens/RegisterScreen.js';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen.js';
import { VerifyEmailConfirmScreen } from '../screens/VerifyEmailConfirmScreen.js';
import { VerifyEmailNoticeScreen } from '../screens/VerifyEmailNoticeScreen.js';
import type { Route } from '../routing/Route.js';
import { RouteResolver } from '../routing/RouteResolver.js';
import { useAppDependencies } from './AppContext.js';

const PROTECTED_ROUTES = new Set<Route['name']>(['home', 'logWorkout', 'history']);
const AUTH_ROUTES = new Set<Route['name']>([
  'login',
  'register',
  'forgotPassword',
  'resetPassword',
  'verifyEmailNotice',
  'verifyEmailConfirm',
]);

/**
 * Props for the root {@link App} component. The resolver is injected
 * so tests can supply a stub that always returns a known route.
 */
export interface AppProps {
  readonly resolver?: RouteResolver;
}

/**
 * Top-level app shell. Owns:
 *
 *  - URL-to-route resolution (via {@link RouteResolver}).
 *  - Redirect rules: an unauthenticated user hitting a protected route
 *    bounces to `/login`; a logged-in user hitting an auth route
 *    bounces to `/`.
 *  - A `popstate` listener so the browser back/forward buttons and
 *    the imperative {@link Navigator} both drive a re-render.
 *  - A session-logout subscription so a server-side token revocation
 *    sends the user back to `/login` without manual intervention.
 */
export function App(props: AppProps): JSX.Element {
  const deps = useAppDependencies();
  const resolver = useMemo(() => props.resolver ?? new RouteResolver(), [props.resolver]);
  const [route, setRoute] = useState<Route>(() =>
    resolver.resolve(window.location.pathname, window.location.search)
  );
  const [hasSession, setHasSession] = useState<boolean>(() => deps.session.hasSession());

  const refreshRoute = useCallback(() => {
    setRoute(resolver.resolve(window.location.pathname, window.location.search));
    setHasSession(deps.session.hasSession());
  }, [deps.session, resolver]);

  useEffect(() => {
    window.addEventListener('popstate', refreshRoute);
    return () => {
      window.removeEventListener('popstate', refreshRoute);
    };
  }, [refreshRoute]);

  useEffect(() => {
    return deps.session.onLogout(() => {
      setHasSession(false);
      deps.navigator.replace('/login');
    });
  }, [deps.navigator, deps.session]);

  useEffect(() => {
    if (!hasSession && PROTECTED_ROUTES.has(route.name)) {
      deps.navigator.replace('/login');
    } else if (hasSession && AUTH_ROUTES.has(route.name) && route.name !== 'verifyEmailConfirm') {
      deps.navigator.replace('/');
    }
  }, [deps.navigator, hasSession, route]);

  return (
    <div className="app-shell">
      <TopBar hasSession={hasSession} />
      <main className="app-main">{renderRoute(route)}</main>
    </div>
  );
}

function renderRoute(route: Route): JSX.Element {
  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'login':
      return <LoginScreen />;
    case 'register':
      return <RegisterScreen />;
    case 'verifyEmailNotice':
      return <VerifyEmailNoticeScreen email={route.email ?? ''} />;
    case 'verifyEmailConfirm':
      return <VerifyEmailConfirmScreen token={route.token ?? ''} />;
    case 'forgotPassword':
      return <ForgotPasswordScreen />;
    case 'resetPassword':
      return <ResetPasswordScreen token={route.token ?? ''} />;
    case 'logWorkout':
      return <LogWorkoutScreen />;
    case 'history':
      return <HistoryScreen />;
    case 'notFound':
    default:
      return <NotFoundScreen />;
  }
}
