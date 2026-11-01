/**
 * Enum of every logical screen in the PWA shell.
 *
 * The router (see {@link ../routing/Router.tsx}) maps the browser URL
 * to one of these values and renders the corresponding screen. New
 * routes are added here first so a screen cannot be reached from an
 * unknown URL by accident.
 */
export type RouteName =
  | 'home'
  | 'login'
  | 'register'
  | 'verifyEmailNotice'
  | 'verifyEmailConfirm'
  | 'forgotPassword'
  | 'resetPassword'
  | 'logWorkout'
  | 'history'
  | 'notFound';

/**
 * Resolved route including any parameters that were parsed from the
 * query string.
 */
export interface Route {
  readonly name: RouteName;
  readonly token?: string;
  readonly email?: string;
}
