'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { PasswordInput } from './PasswordInput';
import { googleMode, nativeGoogleSignIn } from './nativeApp';

type Step = 'login' | 'code-email' | 'code-enter' | 'forgot' | 'reset' | 'signup' | 'signup-code';

async function post(url: string, body: object) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Something went wrong');
  return json;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the Google Identity Services script has no bundled types */
declare global {
  interface Window {
    google?: any;
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiLoading: Promise<void> | null = null;
function loadGsi() {
  gsiLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gsiLoading = null;
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(s);
  });
  return gsiLoading;
}

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/** Google's own "Continue with Google" button; hands back a signed ID token that the server verifies. */
function GoogleButton({ clientId, onCredential, onError }: { clientId: string; onCredential: (credential: string) => void; onError: (msg: string) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  const err = useRef(onError);
  useEffect(() => {
    cb.current = onCredential;
    err.current = onError;
  });
  useEffect(() => {
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !slot.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r: { credential: string }) => cb.current(r.credential), ux_mode: 'popup' });
        window.google.accounts.id.renderButton(slot.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, slot.current.offsetWidth)),
        });
      })
      .catch((e) => err.current((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);
  return <div ref={slot} className="google-slot" />;
}

/**
 * Sign-in for everyone (owner, members, free users) plus free sign-up.
 * Free accounts only get the resume builder; the server decides where each account lands (`to`).
 */
export default function Login({ googleClientId = '', startWith = 'login' }: { googleClientId?: string; startWith?: 'login' | 'signup' }) {
  const [step, setStep] = useState<Step>(startWith);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  // decided after load (it depends on the browser vs the Android app), so the server render always matches
  const [gMode, setGMode] = useState<'web' | 'native' | 'none'>('web');
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time check of where we're running
  useEffect(() => setGMode(googleMode()), []);

  const run = (fn: (form: FormData) => Promise<void>) => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await fn(form);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const signedIn = (res: { to?: string }) => window.location.replace(res.to || '/admin');

  const login = run(async (f) => signedIn(await post('/api/auth/login', { email: f.get('email'), password: f.get('password') })));

  const sendCode = run(async (f) => {
    const addr = String(f.get('email'));
    const res = await post('/api/auth/code', { action: 'send', email: addr });
    setEmail(addr);
    setInfo(res.message);
    setStep('code-enter');
  });

  const verifyCode = run(async (f) => signedIn(await post('/api/auth/code', { action: 'verify', email, code: f.get('code') })));

  const forgot = run(async (f) => {
    const addr = String(f.get('email'));
    const res = await post('/api/auth/forgot', { email: addr });
    setEmail(addr);
    setInfo(res.message);
    setStep('reset');
  });

  const reset = run(async (f) => {
    if (f.get('password') !== f.get('confirm')) throw new Error('The two passwords do not match');
    signedIn(await post('/api/auth/reset', { email, code: f.get('code'), password: f.get('password') }));
  });

  const signup = run(async (f) => {
    const addr = String(f.get('email'));
    const res = await post('/api/auth/signup', { action: 'send', name: f.get('name'), email: addr, password: f.get('password'), website: f.get('website') });
    setEmail(addr);
    setInfo(res.message);
    setStep('signup-code');
  });

  const verifySignup = run(async (f) => signedIn(await post('/api/auth/signup', { action: 'verify', email, code: f.get('code') })));

  const nativeGoogle = async () => {
    setError('');
    try {
      await google(await nativeGoogleSignIn(googleClientId));
    } catch (err) {
      setError(`Couldn’t sign in with Google: ${(err as Error).message}`);
    }
  };

  const google = async (credential: string) => {
    setBusy(true);
    setError('');
    try {
      signedIn(await post('/api/auth/google', { credential }));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const go = (s: Step) => {
    setStep(s);
    setError('');
    setInfo('');
  };

  const isMethodStep = step === 'login' || step === 'code-email';
  const isSignup = step === 'signup';

  return (
    <div className="site login-page">
      <div className="bg-glow" aria-hidden="true" />
      <div className="card login-card">
        <BrandLogo size={84} />

        {(isMethodStep || isSignup) && (
          <>
            <div>
              <h1>{isSignup ? 'Create your free account' : 'Sign in'}</h1>
              <p className="muted">{isSignup ? 'Save your resume and open it on any device. Free, no card needed.' : 'Welcome back to ReuseMe.'}</p>
            </div>

            {googleClientId && gMode !== 'none' && (
              <>
                {gMode === 'native' ? (
                  <button type="button" className="btn btn-lg google-btn" onClick={nativeGoogle} disabled={busy}>
                    <GoogleMark /> Continue with Google
                  </button>
                ) : (
                  <GoogleButton clientId={googleClientId} onCredential={google} onError={setError} />
                )}
                <div className="or-divider">
                  <span>or</span>
                </div>
              </>
            )}

            {isMethodStep && (
              <div className="method-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={step === 'login'} className={step === 'login' ? 'on' : ''} onClick={() => go('login')}>
                  Password
                </button>
                <button type="button" role="tab" aria-selected={step === 'code-email'} className={step === 'code-email' ? 'on' : ''} onClick={() => go('code-email')}>
                  Email code
                </button>
              </div>
            )}
          </>
        )}

        {step === 'login' && (
          <form onSubmit={login} className="login-form" method="post">
            <label className="field">
              <span className="label">Email</span>
              <input name="email" type="email" autoComplete="username" required defaultValue={email} />
            </label>
            <label className="field">
              <span className="label">Password</span>
              <PasswordInput name="password" autoComplete="current-password" required />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" className="link-btn" onClick={() => go('forgot')}>
              Forgot password?
            </button>
          </form>
        )}

        {step === 'code-email' && (
          <form onSubmit={sendCode} className="login-form" method="post">
            <p className="muted small">No password needed. We&apos;ll email you a 6-digit code.</p>
            <label className="field">
              <span className="label">Your email</span>
              <input name="email" type="email" autoComplete="username" required defaultValue={email} />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a login code'}
            </button>
          </form>
        )}

        {isMethodStep && (
          <p className="auth-switch">
            New to ReuseMe?{' '}
            <button type="button" className="link-btn" onClick={() => go('signup')}>
              Create a free account
            </button>
          </p>
        )}

        {step === 'code-enter' && (
          <form onSubmit={verifyCode} className="login-form" method="post">
            <h1>Enter your code</h1>
            {info && <p className="form-info">{info}</p>}
            <label className="field">
              <span className="label">6-digit code sent to {email}</span>
              <input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required autoFocus className="code-input" />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button type="button" className="link-btn" onClick={() => go('code-email')}>
              Send a new code
            </button>
          </form>
        )}

        {step === 'signup' && (
          <form onSubmit={signup} className="login-form" method="post">
            <label className="field">
              <span className="label">Your name</span>
              <input name="name" autoComplete="name" required maxLength={80} />
            </label>
            <label className="field">
              <span className="label">Email</span>
              <input name="email" type="email" autoComplete="email" required defaultValue={email} />
            </label>
            <label className="field">
              <span className="label">
                Password <span className="muted small">(optional, or sign in with an email code)</span>
              </span>
              <PasswordInput name="password" autoComplete="new-password" minLength={6} />
            </label>
            <input name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Sending code…' : 'Create account'}
            </button>
            <p className="auth-switch">
              Already have an account?{' '}
              <button type="button" className="link-btn" onClick={() => go('login')}>
                Sign in
              </button>
            </p>
          </form>
        )}

        {step === 'signup-code' && (
          <form onSubmit={verifySignup} className="login-form" method="post">
            <h1>Confirm your email</h1>
            {info && <p className="form-info">{info}</p>}
            <label className="field">
              <span className="label">6-digit code sent to {email}</span>
              <input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required autoFocus className="code-input" />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Checking…' : 'Create my account'}
            </button>
            <button type="button" className="link-btn" onClick={() => go('signup')}>
              ← Change details or send a new code
            </button>
          </form>
        )}

        {step === 'forgot' && (
          <form onSubmit={forgot} className="login-form" method="post">
            <h1>Reset password</h1>
            <p className="muted">Enter your account email. We&apos;ll send a 6-digit code to it.</p>
            <label className="field">
              <span className="label">Email</span>
              <input name="email" type="email" autoComplete="username" required autoFocus defaultValue={email} />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
            <button type="button" className="link-btn" onClick={() => go('login')}>
              ← Back to sign in
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={reset} className="login-form" method="post">
            <h1>Choose a new password</h1>
            {info && <p className="form-info">{info}</p>}
            <label className="field">
              <span className="label">6-digit code</span>
              <input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required autoFocus />
            </label>
            <label className="field">
              <span className="label">New password</span>
              <PasswordInput name="password" autoComplete="new-password" minLength={6} required />
            </label>
            <label className="field">
              <span className="label">Confirm new password</span>
              <PasswordInput name="confirm" autoComplete="new-password" minLength={6} required />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Saving…' : 'Save password & sign in'}
            </button>
            <button type="button" className="link-btn" onClick={() => go('forgot')}>
              Send a new code
            </button>
          </form>
        )}

        <p className="muted small login-foot">
          <Link href="/">← Back to site</Link> · <Link href="/privacy">Privacy policy</Link>
        </p>
      </div>
    </div>
  );
}
