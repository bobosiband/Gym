import { useCallback, useState } from 'react';

import { HttpError } from '../api/HttpError.js';
import { useAppDependencies } from '../app/AppContext.js';

/**
 * `/login` screen. Collects email and password, hands them to the
 * auth client, saves the returned tokens on success and redirects
 * to the home screen.
 */
export function LoginScreen(): JSX.Element {
  const { authApi, session, navigator } = useAppDependencies();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setSubmitting(true);
      try {
        const tokens = await authApi.login(email, password);
        session.login(tokens);
        navigator.replace('/');
      } catch (err) {
        setError(describeError(err));
      } finally {
        setSubmitting(false);
      }
    },
    [authApi, email, navigator, password, session]
  );

  return (
    <section aria-labelledby="login-title">
      <h1 id="login-title">Log in</h1>
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
            autoComplete="current-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error !== null ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p>
        <a href="/forgot-password">Forgot password?</a>
      </p>
      <p>
        No account? <a href="/register">Register</a>
      </p>
    </section>
  );
}

function describeError(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.isUnauthorized()) {
      return 'Email or password is incorrect.';
    }
    if (err.code === 'TOO_MANY_REQUESTS') {
      return 'Too many attempts. Try again in a few minutes.';
    }
    return err.serverMessage.length > 0 ? err.serverMessage : 'Login failed.';
  }
  return 'Login failed. Check your connection and try again.';
}
