import { useCallback, useState } from 'react';

import { HttpError } from '../api/HttpError.js';
import { useAppDependencies } from '../app/AppContext.js';

/**
 * Props for {@link ResetPasswordScreen}.
 */
export interface ResetPasswordScreenProps {
  readonly token: string;
}

/**
 * `/reset-password` screen. Reads the reset token from the URL and
 * swaps it for a new password. Reset tokens are single-use and live
 * for 30 minutes server-side.
 */
export function ResetPasswordScreen(props: ResetPasswordScreenProps): JSX.Element {
  const { authApi, navigator } = useAppDependencies();
  const [password, setPassword] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (props.token.length === 0) {
        setError('Reset link is missing a token.');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
      if (password.length < 12) {
        setError('Password must be at least 12 characters.');
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        await authApi.resetPassword(props.token, password);
        navigator.replace('/login');
      } catch (err) {
        console.error(err);
        setError(
          err instanceof HttpError && err.serverMessage.length > 0
            ? err.serverMessage
            : 'Reset failed. Request a new link.'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [authApi, confirm, navigator, password, props.token]
  );

  return (
    <section aria-labelledby="reset-title">
      <h1 id="reset-title">Choose a new password</h1>
      <form onSubmit={onSubmit} noValidate>
        <label>
          New password
          <input
            type="password"
            name="new-password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error !== null ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save new password'}
        </button>
      </form>
    </section>
  );
}
