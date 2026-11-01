import { useEffect, useState } from 'react';

import { HttpError } from '../api/HttpError.js';
import { useAppDependencies } from '../app/AppContext.js';

/**
 * Props for {@link VerifyEmailConfirmScreen}.
 */
export interface VerifyEmailConfirmScreenProps {
  readonly token: string;
}

/**
 * Confirms an email verification token picked up from the URL. Shows
 * a success, failure or in-flight message. On success a link back to
 * the login screen is rendered.
 */
export function VerifyEmailConfirmScreen(props: VerifyEmailConfirmScreenProps): JSX.Element {
  const { authApi } = useAppDependencies();
  const [state, setState] = useState<'verifying' | 'done' | 'error'>('verifying');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (props.token.length === 0) {
      setState('error');
      setMessage('Verification link is missing a token.');
      return;
    }
    let cancelled = false;
    authApi
      .verifyEmail(props.token)
      .then(() => {
        if (!cancelled) {
          setState('done');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setState('error');
        setMessage(
          err instanceof HttpError && err.serverMessage.length > 0
            ? err.serverMessage
            : 'Verification failed. Request a new link from the sign-up screen.'
        );
      });
    return () => {
      cancelled = true;
    };
  }, [authApi, props.token]);

  return (
    <section aria-labelledby="verify-confirm-title">
      <h1 id="verify-confirm-title">Email verification</h1>
      {state === 'verifying' ? <p role="status">Verifying...</p> : null}
      {state === 'done' ? (
        <>
          <p role="status">Your email is verified.</p>
          <p>
            <a href="/login">Continue to log in</a>
          </p>
        </>
      ) : null}
      {state === 'error' ? (
        <p role="alert" className="form-error">
          {message}
        </p>
      ) : null}
    </section>
  );
}
