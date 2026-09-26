'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { PasswordInput } from './PasswordInput';

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

            {googleClientId && (
              <>
                <GoogleButton clientId={googleClientId} onCredential={google} onError={setError} />
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

        <Link href="/" className="muted small">
          ← Back to site
        </Link>
      </div>
    </div>
  );
}
