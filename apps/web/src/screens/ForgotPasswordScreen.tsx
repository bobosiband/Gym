import { useCallback, useState } from 'react';

import { HttpError } from '../api/HttpError.js';
import { useAppDependencies } from '../app/AppContext.js';

/**
 * `/forgot-password` screen. Collects an email and asks the auth
 * service to send a reset link. The response is the same whether or
 * not the account exists, so the UI shows a generic confirmation.
 */
export function ForgotPasswordScreen(): JSX.Element {
  const { authApi } = useAppDependencies();
  const [email, setEmail] = useState<string>('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setState('sending');
      setError(null);
      try {
        await authApi.forgotPassword(email);
        setState('sent');
      } catch (err) {
        console.error(err);
        setState('error');
        setError(err instanceof HttpError ? err.serverMessage : 'Request failed.');
      }
    },
    [authApi, email]
  );

  return (
    <section aria-labelledby="forgot-title">
      <h1 id="forgot-title">Reset your password</h1>
      {state === 'sent' ? (
        <p role="status">
          If an account exists for that address, we have sent a reset link. Check your inbox.
        </p>
      ) : (
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
          {state === 'error' && error !== null ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      )}
      <p>
        <a href="/login">Back to log in</a>
      </p>
    </section>
  );
}
