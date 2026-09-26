'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { gmailCompose } from '@/lib/links';
import { BrandLogo } from './BrandLogo';
import { Icon } from './Icons';

type Plan = 'monthly' | 'yearly';
type Step = 'details' | 'pay' | 'utr' | 'done';
type Saved = { step: Step; id: string; ref: string; name: string; email: string; plan: Plan; slug: string; amount: number; paying?: boolean };
type Status = {
  member: { slug: string; plan: Plan; expiresAt: string; live: boolean } | null;
  request: { status: 'awaiting' | 'submitted' | 'approved' | 'rejected'; slug: string } | null;
};

const KEY = 'rm-join';
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);

function upiLinks(upi: { id: string; name: string }, amount: number, ref: string) {
  const q = `pa=${encodeURIComponent(upi.id)}&pn=${encodeURIComponent(upi.name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`ReuseMe ${ref}`)}`;
  return {
    any: `upi://pay?${q}`,
    phonepe: `phonepe://pay?${q}`,
    paytm: `paytmmp://pay?${q}`,
    gpay: `tez://upi/pay?${q}`,
  };
}

type Support = { whatsapp: string; email: string };

export default function JoinFlow({
  prices,
  upi,
  initialPlan,
  host,
  support,
  account = null,
}: {
  prices: Record<Plan, number>;
  upi: { id: string; name: string };
  initialPlan: Plan;
  host: string;
  support: Support;
  /** the signed-in account: its email is used automatically and can't be changed here */
  account?: { name: string; email: string } | null;
}) {
  const fresh = (): Saved => ({ step: 'details', id: '', ref: '', name: account?.name || '', email: account?.email || '', plan: initialPlan, slug: '', amount: prices[initialPlan] });
  const [s, setS] = useState<Saved>(fresh);
  const [slugEdited, setSlugEdited] = useState(false);
  const [remoteSlug, setRemoteSlug] = useState<{ slug: string; status: 'ok' | 'taken' | 'invalid' } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const loaded = useRef(false);
  const accountEmail = account?.email || '';

  // Resume where the visitor left off (e.g. after switching to their UPI app and back).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as Saved | null;
      // a payment started under another email doesn't belong to the account signed in now
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore
      if (saved?.id && (!accountEmail || saved.email === accountEmail)) setS(saved);
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, [accountEmail]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      if (s.id) localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s]);

  // Coming back from the UPI app: jump to "enter your transaction ID".
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && s.step === 'pay' && s.paying) {
        setS((x) => ({ ...x, step: 'utr' }));
        setWelcomeBack(true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [s.step, s.paying]);

  // Link availability check while typing.
  const slug = s.slug || slugify(s.name);
  const slugState: '' | 'ok' | 'taken' | 'invalid' | 'checking' = !slug ? '' : slug.length < 3 ? 'invalid' : remoteSlug?.slug === slug ? remoteSlug.status : 'checking';
  useEffect(() => {
    if (s.step !== 'details' || slug.length < 3) return;
    const t = setTimeout(() => {
      fetch(`/api/membership?slug=${encodeURIComponent(slug)}&email=${encodeURIComponent(s.email)}`)
        .then((r) => r.json())
        .then((j) => setRemoteSlug({ slug, status: j.status }))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [slug, s.email, s.step]);

  // QR code for paying from another device (desktop).
  useEffect(() => {
    if (s.step !== 'pay' || !s.ref) return;
    QRCode.toString(upiLinks(upi, s.amount, s.ref).any, { type: 'svg', margin: 1, width: 220, color: { dark: '#0b1f3a', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [s.step, s.ref, s.amount, upi]);

  // After submitting, poll until the owner approves.
  useEffect(() => {
    if (s.step !== 'done' || !s.email) return;
    const check = () =>
      fetch(`/api/membership?email=${encodeURIComponent(s.email)}`)
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => {});
    check();
    const t = setInterval(check, 20000);
    return () => clearInterval(t);
  }, [s.step, s.email]);

  const post = async (body: object) => {
    const res = await fetch('/api/membership', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Something went wrong');
    return json;
  };

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await post({ action: 'start', name: s.name, email: s.email, plan: s.plan, slug });
      setS((x) => ({ ...x, step: 'pay', id: r.id, ref: r.ref, amount: r.amount, slug: r.slug, paying: false }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitUtr = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const utr = String(new FormData(e.currentTarget).get('utr') || '');
    setBusy(true);
    setError('');
    try {
      await post({ action: 'submit', id: s.id, email: s.email, utr });
      setS((x) => ({ ...x, step: 'done', paying: false }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setS(fresh());
    setStatus(null);
    setError('');
  };

  const links = s.ref ? upiLinks(upi, s.amount, s.ref) : null;
  const markPaying = () => setS((x) => ({ ...x, paying: true }));
  const stepNo = { details: 1, pay: 2, utr: 3, done: 4 }[s.step];

  return (
    <div className="site join-page">
      <div className="bg-glow" aria-hidden="true" />
      <nav className="nav scrolled">
        <div className="wrap nav-inner">
          <Link href="/" className="logo" aria-label="ReuseMe home">
            <BrandLogo size={34} />
            <span className="rm-word">
              <b>Reuse</b>Me
            </span>
          </Link>
          {account ? (
            <span className="join-signin join-account" title={account.email}>
              <Icon name="user" size={15} /> {account.name}
            </span>
          ) : (
            <Link href="/login" className="btn btn-ghost btn-sm join-signin">
              Sign in
            </Link>
          )}
        </div>
      </nav>

      <main className="wrap join">
        <header className="join-head">
          <span className="eyebrow">Your own portfolio website</span>
          <h1>Get a portfolio like this, with your own link</h1>
          <p className="muted">Pay once a month or once a year by UPI. We set up your site and email your login to your Gmail.</p>
        </header>

        <ol className="join-steps" aria-label="Progress">
          {['Your details', 'Pay by UPI', 'Confirm payment', 'Done'].map((label, i) => (
            <li key={label} className={i + 1 < stepNo ? 'done' : i + 1 === stepNo ? 'on' : ''}>
              <span>{i + 1 < stepNo ? <Icon name="check" size={14} /> : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        {s.step === 'details' && (
          <form className="card join-card" onSubmit={start}>
            <div className="plan-grid" role="radiogroup" aria-label="Plan">
              {(['monthly', 'yearly'] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  role="radio"
                  aria-checked={s.plan === p}
                  className={`plan ${s.plan === p ? 'on' : ''}`}
                  onClick={() => setS((x) => ({ ...x, plan: p, amount: prices[p] }))}
                >
                  {p === 'yearly' && <span className="plan-badge">Save ₹{prices.monthly * 12 - prices.yearly}</span>}
                  <b>₹{prices[p]}</b>
                  <span>{p === 'yearly' ? 'per year' : 'per month'}</span>
                </button>
              ))}
            </div>
            <div className="fields">
              <label className="field full">
                <span className="label">Your full name</span>
                <input required minLength={2} maxLength={60} value={s.name} onChange={(e) => setS((x) => ({ ...x, name: e.target.value, slug: slugEdited ? x.slug : '' }))} placeholder="Riya Sharma" autoComplete="name" />
              </label>
              <label className="field full">
                <span className="label">Your Gmail</span>
                <input
                  required
                  type="email"
                  value={s.email}
                  onChange={(e) => setS((x) => ({ ...x, email: e.target.value }))}
                  placeholder="you@gmail.com"
                  autoComplete="email"
                  readOnly={Boolean(account)}
                />
                <small className="hint">
                  {account ? 'You’re signed in with this email, so your portfolio is added to this account.' : 'Your login and updates are sent here. It is also your sign-in email.'}
                </small>
              </label>
              <label className="field full">
                <span className="label">Your website link</span>
                <span className="slug-input">
                  <span className="slug-prefix">{host}/</span>
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setS((x) => ({ ...x, slug: slugify(e.target.value) }));
                    }}
                    placeholder="riya-sharma"
                    aria-label="Website link"
                  />
                </span>
                <small className={`hint slug-${slugState}`}>
                  {slugState === 'ok' && '✓ Available'}
                  {slugState === 'taken' && 'Already taken. Try another.'}
                  {slugState === 'invalid' && 'Use 3–30 letters, numbers or dashes.'}
                  {slugState === 'checking' && 'Checking…'}
                </small>
              </label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy || slugState === 'taken' || slugState === 'invalid'}>
              Continue to payment · ₹{prices[s.plan]}
            </button>
            <StatusLookup email={account?.email} />
          </form>
        )}

        {s.step === 'pay' && links && (
          <div className="card join-card pay">
            <div className="pay-amount">
              <span className="muted">Pay</span>
              <b>₹{s.amount}</b>
              <span className="muted">{s.plan === 'yearly' ? 'for 1 year' : 'for 1 month'}</span>
            </div>
            <div className="pay-to">
              <span>
                To <b>{upi.name}</b>
              </span>
              <button type="button" className="chip" onClick={() => navigator.clipboard?.writeText(upi.id)} title="Copy UPI ID">
                {upi.id} <Icon name="copy" size={13} />
              </button>
            </div>
            <p className="pay-ref">
              Keep this note in the payment: <code>ReuseMe {s.ref}</code>
            </p>

            <a className="btn btn-primary btn-lg pay-any" href={links.any} onClick={markPaying}>
              <Icon name="send" size={18} /> Pay ₹{s.amount} with any UPI app
            </a>
            <div className="pay-apps">
              <a href={links.phonepe} onClick={markPaying} className="pay-app phonepe">
                PhonePe
              </a>
              <a href={links.paytm} onClick={markPaying} className="pay-app paytm">
                Paytm
              </a>
              <a href={links.gpay} onClick={markPaying} className="pay-app gpay">
                Google Pay
              </a>
            </div>

            {qr && (
              <div className="qr-box">
                <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
                <p className="muted small">On a computer? Scan with any UPI app on your phone.</p>
              </div>
            )}

            <button type="button" className="btn btn-ghost" onClick={() => setS((x) => ({ ...x, step: 'utr' }))}>
              I&apos;ve paid, next <Icon name="chevron" size={15} />
            </button>
            <button type="button" className="link-btn" onClick={() => setS((x) => ({ ...x, step: 'details' }))}>
              ← Change details
            </button>
          </div>
        )}

        {s.step === 'utr' && (
          <form className="card join-card" onSubmit={submitUtr}>
            {welcomeBack && <p className="form-info">Welcome back! If your payment went through, confirm it below.</p>}
            <h2 className="join-h2">Confirm your payment</h2>
            <p className="muted">
              Open your UPI app&apos;s history and copy the <b>UPI transaction ID</b> (also called UTR or reference number, usually 12 digits) for your ₹{s.amount} payment.
            </p>
            <label className="field">
              <span className="label">UPI transaction ID</span>
              <input name="utr" required inputMode="numeric" autoComplete="off" placeholder="e.g. 412345678901" minLength={10} maxLength={22} />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit payment'}
            </button>
            <button type="button" className="link-btn" onClick={() => setS((x) => ({ ...x, step: 'pay' }))}>
              ← Back to payment
            </button>
            <SupportNote support={support} s={s} compact />
          </form>
        )}

        {s.step === 'done' && (
          <div className="card join-card done">
            {status?.member?.live ? (
              <>
                <span className="sent-icon">
                  <Icon name="check" size={26} />
                </span>
                <h2 className="join-h2">You&apos;re in! 🎉</h2>
                <p className="muted">
                  Your login details were sent to <b>{s.email}</b>. Sign in to build your site, then change the starter password under More → Account &amp; password.
                </p>
                <div className="row-gap center">
                  <Link className="btn btn-primary btn-lg" href="/admin">
                    Sign in
                  </Link>
                  <Link className="btn btn-ghost btn-lg" href={`/${status.member.slug}`}>
                    View /{status.member.slug}
                  </Link>
                </div>
              </>
            ) : status?.request?.status === 'rejected' ? (
              <>
                <h2 className="join-h2">We couldn&apos;t verify that payment</h2>
                <p className="muted">Please check the transaction ID and try again. If you did pay, contact us and we&apos;ll sort it out or refund you.</p>
                <button className="btn btn-primary" onClick={() => setS((x) => ({ ...x, step: 'utr' }))}>
                  Enter the ID again
                </button>
                <SupportNote support={support} s={s} />
              </>
            ) : (
              <>
                <div className="loader-mini" aria-hidden="true">
                  <svg viewBox="-13 -13 26 26">
                    <path d="M0 -13 C1.6 -4 4 -1.6 13 0 C4 1.6 1.6 4 0 13 C-1.6 4 -4 1.6 -13 0 C-4 -1.6 -1.6 -4 0 -13 Z" />
                  </svg>
                </div>
                <h2 className="join-h2">Payment submitted</h2>
                <p className="muted">
                  We&apos;re checking your ₹{s.amount} payment (reference <code>{s.ref}</code>). As soon as it&apos;s confirmed, your login is emailed to <b>{s.email}</b>. This
                  page updates by itself.
                </p>
                <SupportNote support={support} s={s} />
              </>
            )}
            <button className="link-btn" onClick={reset}>
              Start a new request
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

/** Help box: if the site isn't live within 5 hours, contact us by email or WhatsApp (for help or a refund). */
function SupportNote({ support, s, compact = false }: { support: Support; s: Saved; compact?: boolean }) {
  const msg = `Hi, I paid ₹${s.amount} for the ReuseMe ${s.plan} plan.
Reference: ${s.ref}
Gmail: ${s.email}
Link: /${s.slug}
My website is not live yet.`;
  const wa = `https://wa.me/${support.whatsapp}?text=${encodeURIComponent(msg)}`;
  const mail = gmailCompose(support.email, `ReuseMe payment ${s.ref}`, msg);
  const phone = support.whatsapp.replace(/^91(\d{5})(\d{5})$/, '+91 $1 $2');
  return (
    <div className={`support-note ${compact ? 'compact' : ''}`}>
      <p>
        <b>Website not live within 5 hours?</b> Email or WhatsApp us at <b>{phone}</b> with your reference <code>{s.ref}</code>. We&apos;ll fix it or give you a full
        refund.
      </p>
      <div className="row-gap">
        <a className="btn btn-sm support-wa" href={wa} target="_blank" rel="noopener noreferrer">
          WhatsApp {phone}
        </a>
        {support.email && (
          <a className="btn btn-sm" href={mail} target="_blank" rel="noopener noreferrer">
            <Icon name="mail" size={14} /> Email us
          </a>
        )}
      </div>
    </div>
  );
}

function statusMessage(r: Status) {
  if (r.member?.live) return `Active until ${new Date(r.member.expiresAt).toLocaleDateString('en-IN')}. Your site: /${r.member.slug}. Sign in with this Gmail.`;
  if (r.member) return 'Your membership has ended. Choose a plan above to renew.';
  if (r.request?.status === 'submitted') return 'We received your payment details and are verifying them.';
  if (r.request?.status === 'rejected') return 'We could not verify your last payment. Please try again.';
  return '';
}

/** "Already paid?" lookup by Gmail; for a signed-in account it checks that account's email straight away. */
function StatusLookup({ email: accountEmail = '' }: { email?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const lookup = (addr: string) => fetch(`/api/membership?email=${encodeURIComponent(addr)}`).then((x) => x.json() as Promise<Status>);
  const check = async () => setMsg(statusMessage(await lookup(email)) || 'No membership found for this Gmail yet.');
  useEffect(() => {
    if (accountEmail) lookup(accountEmail).then((r) => setMsg(statusMessage(r)), () => {});
  }, [accountEmail]);
  if (accountEmail) return msg ? <p className="muted small status-lookup">{msg}</p> : null;
  if (!open)
    return (
      <button type="button" className="link-btn" onClick={() => setOpen(true)}>
        Already paid? Check your status
      </button>
    );
  return (
    <div className="status-lookup">
      <input type="email" placeholder="your Gmail" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="button" className="btn btn-sm" onClick={check} disabled={!email.includes('@')}>
        Check
      </button>
      {msg && <p className="muted small">{msg}</p>}
    </div>
  );
}
