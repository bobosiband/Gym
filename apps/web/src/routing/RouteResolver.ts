import type { Route } from './Route.js';

/**
 * Parses the browser URL into a {@link Route}. Pure and injectable so
 * tests do not have to touch `window.location`.
 *
 * Path matching is deliberately a flat table rather than a regex
 * router: the PWA has fewer than a dozen screens and the table reads
 * at a glance.
 */
export class RouteResolver {
  /**
   * Resolve a pathname + query to a {@link Route}. Unknown paths map
   * to `notFound` so the shell can show a dedicated screen instead of
   * a blank page.
   */
  public resolve(pathname: string, search: string): Route {
    const params = new URLSearchParams(search);
    const path = this.normalise(pathname);
    switch (path) {
      case '/':
        return { name: 'home' };
      case '/login':
        return { name: 'login' };
      case '/register':
        return { name: 'register' };
      case '/verify-email':
        return this.resolveVerify(params);
      case '/forgot-password':
        return { name: 'forgotPassword' };
      case '/reset-password':
        return this.resolveReset(params);
      case '/log-workout':
        return { name: 'logWorkout' };
      case '/history':
        return { name: 'history' };
      default:
        return { name: 'notFound' };
    }
  }

  private resolveVerify(params: URLSearchParams): Route {
    const token = params.get('token');
    if (token !== null && token.length > 0) {
      return { name: 'verifyEmailConfirm', token };
    }
    const email = params.get('email');
    return email !== null && email.length > 0
      ? { name: 'verifyEmailNotice', email }
      : { name: 'verifyEmailNotice' };
  }

  private resolveReset(params: URLSearchParams): Route {
    const token = params.get('token');
    return token !== null && token.length > 0
      ? { name: 'resetPassword', token }
      : { name: 'resetPassword' };
  }

  private normalise(pathname: string): string {
    if (pathname.length <= 1) {
      return '/';
    }
    return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  }
}
