import { useCallback, useState } from 'react';

import { HttpError } from '../api/HttpError.js';
import { useAppDependencies } from '../app/AppContext.js';

/**
 * Props for {@link VerifyEmailNoticeScreen}.
 */
export interface VerifyEmailNoticeScreenProps {
  readonly email: string;
}

/**
 * Static page shown after a successful registration. Includes a
 * resend-verification button so a user who did not get the email can
 * request another without re-registering.
 */
export function VerifyEmailNoticeScreen(props: VerifyEmailNoticeScreenProps): JSX.Element {
  const { authApi } = useAppDependencies();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const onResend = useCallback(async () => {
    if (props.email.length === 0) {
      setStatus('error');
      setMessage('No email on file. Start again from the register screen.');
      return;
    }
    setStatus('sending');
    setMessage(null);
    try {
      await authApi.resendVerification(props.email);
      setStatus('sent');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err instanceof HttpError ? err.serverMessage : 'Could not resend.');
    }
  }, [authApi, props.email]);

  return (
    <section aria-labelledby="verify-notice-title">
      <h1 id="verify-notice-title">Check your inbox</h1>
      <p>
        We sent a verification link to <strong>{props.email || 'your email'}</strong>. Open it to
        activate your account.
      </p>
      <p>
        No email?{' '}
        <button type="button" onClick={onResend} disabled={status === 'sending'}>
          Resend verification
        </button>
      </p>
      {status === 'sent' ? <p role="status">Sent. Check your inbox again.</p> : null}
      {status === 'error' && message !== null ? (
        <p role="alert" className="form-error">
          {message}
        </p>
      ) : null}
    </section>
  );
}
