'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

type Mode = 'idle' | 'working' | 'link-sent' | 'reset-sent';

/**
 * Real sign-in behind the prototype's login markup. Classes and structure are
 * kept exactly as designed - only the two dead `<a href>` buttons become real
 * actions, plus inline status for the states the prototype had no place for.
 */
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [error, setError] = useState('');

  const busy = mode === 'working';

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMode('working');

    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      setMode('idle');
      setError(error.message);
      return;
    }
    // A server component decides where this person belongs.
    router.push('/portal');
    router.refresh();
  }

  async function signInWithGoogle() {
    setError('');
    setMode('working');

    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });

    // On success the browser has already left for Google, so only a failure
    // gets this far.
    if (error) {
      setMode('idle');
      setError(
        error.message.includes('not enabled')
          ? 'Google sign-in is not switched on yet. Use your email and password.'
          : error.message,
      );
    }
  }

  async function emailSignInLink() {
    if (!email) return setError('Enter your work email first.');
    setError('');
    setMode('working');

    await supabaseBrowser().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        // Without this, Supabase creates an account for whatever address is
        // typed here. There is no self-signup - accounts are made by staff -
        // so a stranger must not be able to fill the auth table from a public
        // form.
        shouldCreateUser: false,
      },
    });

    // Always report the same thing. Saying "no such account" would turn this
    // form into a way to find out who has one.
    setMode('link-sent');
  }

  async function sendReset(e: React.MouseEvent) {
    e.preventDefault();
    if (!email) return setError('Enter your work email first, then click Forgot.');
    setError('');
    setMode('working');

    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/portal`,
    });
    setMode(error ? 'idle' : 'reset-sent');
    if (error) setError(error.message);
  }

  if (mode === 'link-sent' || mode === 'reset-sent') {
    return (
      <div className="box">
        <h1>Check your email.</h1>
        <p className="sub" style={{ color: 'var(--muted)' }}>
          {mode === 'link-sent'
            ? `If ${email} has an account, a one-time sign-in link is on its way.`
            : `If ${email} has an account, a link to set a new password is on its way.`}
        </p>
        <button type="button" className="pill pill-light" onClick={() => setMode('idle')}>
          Back to log in
        </button>
      </div>
    );
  }

  return (
    <form className="box" onSubmit={signInWithPassword}>
      <h1>Log in</h1>
      <p className="sub" style={{ color: 'var(--muted)' }}>
        Use the email your reports are sent to.
      </p>

      {/* First, because it is how the team signs in. Customers use the password
          below. */}
      <button className="pill pill-light" type="button" onClick={signInWithGoogle} disabled={busy}>
        <GoogleMark /> Continue with Google
      </button>

      <div className="or">or</div>

      <label className="field">
        <span>Work email</span>
        <input
          type="email"
          autoComplete="email"
          required
          placeholder="dana@yourcompany.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="field">
        <span>
          Password{' '}
          <a className="forgot" href="#" onClick={sendReset}>
            Forgot?
          </a>
        </span>
        <input
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && (
        <p role="alert" style={{ margin: '0 0 4px', color: '#B42318', fontSize: 14 }}>
          {error}
        </p>
      )}

      <button className="pill pill-coral" type="submit" disabled={busy}>
        {busy ? 'One moment…' : 'Continue'}
      </button>

      <div className="or">or</div>

      <button className="pill pill-light" type="button" onClick={emailSignInLink} disabled={busy}>
        Email me a sign-in link
      </button>

      <p className="foot">
        New to Customs Data Lock? <a href="/exposure-check">Run a free exposure check</a>.
      </p>
    </form>
  );
}

/** Google's mark, in its official four colours. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.4z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.7-3.8-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
