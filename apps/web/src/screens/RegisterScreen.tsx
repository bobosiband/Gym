import { useCallback, useState } from 'react';

import { HttpError } from '../api/HttpError.js';
import { useAppDependencies } from '../app/AppContext.js';

/**
 * `/register` screen. Collects email and password, submits to the
 * auth service, and navigates to the verify-email notice so the user
 * knows to check their inbox. The server returns the same generic
 * response whether or not the account already exists, so the UI
 * does the same.
 */
export function RegisterScreen(): JSX.Element {
  const { authApi, navigator } = useAppDependencies();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
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
        await authApi.register(email, password);
        navigator.navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      } catch (err) {
        console.error(err);
        setError(describeError(err));
      } finally {
        setSubmitting(false);
      }
    },
    [authApi, confirm, email, navigator, password]
  );

  return (
    <section aria-labelledby="register-title">
      <h1 id="register-title">Create your account</h1>
      <form onSubmit={onSubmit} noValidate>
        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
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
          {submitting ? 'Creating...' : 'Create account'}
        </button>
      </form>
      <p>
        Already registered? <a href="/login">Log in</a>
      </p>
    </section>
  );
}

function describeError(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.code === 'TOO_MANY_REQUESTS') {
      return 'Too many sign-ups from this address. Try again later.';
    }
    return err.serverMessage.length > 0 ? err.serverMessage : 'Could not register.';
  }
  return 'Could not register. Check your connection and try again.';
}
