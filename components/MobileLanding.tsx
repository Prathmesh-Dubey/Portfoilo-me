'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { AccountSummary } from '@/lib/auth';
import { useBackClose } from './backClose';
import { BrandLogo } from './BrandLogo';
import { Icon, type IconName } from './Icons';
import { enterPreview, exitPreview, isPreviewOn, onPreviewChange } from './previewMode';

/**
 * Phone-only first page for "/": explains ReuseMe and pushes the free resume builder.
 * Shown by CSS below 820px (see .mobile-landing); desktop keeps the portfolio as the home page.
 * "Preview live portfolio" swaps to the portfolio (html.rm-preview, remembered for this visit).
 * `standalone`: the same page at /live (desktop navbar's "Live" button), always shown; previews open "/".
 */
export default function MobileLanding({
  prices,
  ownerName,
  account = null,
  standalone = false,
}: {
  prices: { monthly: number; yearly: number };
  ownerName: string;
  /** the signed-in account (shown instead of "Sign in") */
  account?: AccountSummary;
  standalone?: boolean;
}) {
  const router = useRouter();
  const preview = () => (standalone ? router.push('/') : enterPreview());

  // Reflect preview mode reactively (from either this component's own button or the
  // "Back to ReuseMe" bar in Portfolio) so a back gesture/hardware back can exit it
  // instead of leaving the app — there's no Escape key on a phone.
  const [previewOn, setPreviewOn] = useState(false);
  useEffect(() => {
    setPreviewOn(isPreviewOn());
    return onPreviewChange(() => setPreviewOn(isPreviewOn()));
  }, []);
  useBackClose(!standalone && previewOn, exitPreview);

  const features: { icon: IconName; title: string; text: string }[] = [
    { icon: 'file', title: 'Four pro templates', text: 'Creative, Classic ATS, Modern sidebar or Timeline: recruiter-friendly and clean.' },
    { icon: 'check', title: 'Always one page', text: 'Text size adjusts automatically so everything fits on a single page.' },
    { icon: 'eye', title: 'Live PDF preview', text: 'See the real PDF update as you type. Download in one tap.' },
    { icon: 'lock', title: 'Private by design', text: 'Your draft stays on your device, or safely in your free account if you sign up.' },
  ];

  return (
    <div className={`mobile-landing ${standalone ? 'ml-standalone' : ''}`}>
      <div className="bg-glow" aria-hidden="true" />
      <header className="ml-top">
        <span className="ml-brand">
          <BrandLogo size={36} />
          <span className="rm-word">
            <b>Reuse</b>Me
          </span>
        </span>
        {/* desktop /live only (see .ml-standalone) */}
        <nav className="ml-nav" aria-label="Sections">
          <a href="#ml-features">Features</a>
          <a href="#ml-how">How it works</a>
          <a href="#ml-pricing">Pricing</a>
        </nav>
        {account ? (
          <AccountMenu account={account} />
        ) : (
          <Link href="/login" className="btn btn-ghost btn-sm">
            Sign in
          </Link>
        )}
      </header>

      <section className="ml-hero">
        <span className="status-pill">
          <Icon name="sparkle" size={14} /> Free resume builder
        </span>
        <h1>
          Build a job-ready resume in <span className="grad">minutes.</span>
        </h1>
        <p className="muted">Fill in your details, pick a design, and download a clean one-page PDF. No watermark, and a free account keeps it safe on any device.</p>
        <div className="ml-actions">
          <Link href="/resume-builder" className="btn btn-primary btn-lg ml-cta">
            <Icon name="sparkle" size={18} /> Build my resume, free
          </Link>
          <button className="btn btn-ghost btn-lg" onClick={preview}>
            <Icon name="eye" size={18} /> Preview live portfolio
          </button>
        </div>

        <div className="ml-visual" aria-hidden="true">
          <div className="loader-stage">
            <div className="loader-page">
              <span className="lp-avatar" />
              <span className="lp-line lp-title" />
              <span className="lp-line lp-sub" />
              <span className="lp-line l1" />
              <span className="lp-line l2" />
              <span className="lp-line l3" />
              <span className="lp-line l4" />
            </div>
            <svg className="loader-spark" viewBox="-13 -13 26 26">
              <path d="M0 -13 C1.6 -4 4 -1.6 13 0 C4 1.6 1.6 4 0 13 C-1.6 4 -4 1.6 -13 0 C-4 -1.6 -1.6 -4 0 -13 Z" />
            </svg>
            <span className="loader-shadow" />
          </div>
        </div>
      </section>

      <section className="ml-section" id="ml-features">
        <h2>What ReuseMe does</h2>
        <div className="ml-features">
          {features.map((f) => (
            <article key={f.title} className="card ml-feature">
              <span className="ml-icon">
                <Icon name={f.icon} size={20} />
              </span>
              <div>
                <h3>{f.title}</h3>
                <p className="muted">{f.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="ml-section" id="ml-how">
        <h2>How it works</h2>
        <ol className="ml-steps">
          <li>
            <b>Add your details</b>
            <span className="muted">Experience, projects, skills and education.</span>
          </li>
          <li>
            <b>Pick a design</b>
            <span className="muted">Choose a template, colour and paper size.</span>
          </li>
          <li>
            <b>Download your PDF</b>
            <span className="muted">Ready to send to recruiters.</span>
          </li>
        </ol>
        <Link href="/resume-builder" className="btn btn-primary btn-lg ml-cta">
          Start building <Icon name="chevron" size={16} />
        </Link>
      </section>

      <section className="ml-section ml-pricing" id="ml-pricing">
        <span className="eyebrow">Go further</span>
        <h2>Want a portfolio website like this?</h2>
        <p className="muted">
          Get your own site with a personal link, like {ownerName.split(' ')[0]}&apos;s. Edit it anytime from your phone, show your projects with live previews, and let people download your resume.
        </p>
        <button className="btn btn-ghost ml-preview-link" onClick={preview}>
          <Icon name="eye" size={16} /> See an example portfolio
        </button>
        <div className="ml-plans">
          <Link href="/join?plan=monthly" className="card ml-plan">
            <span className="muted">Monthly</span>
            <b>₹{prices.monthly}</b>
            <span className="muted small">per month</span>
          </Link>
          <Link href="/join?plan=yearly" className="card ml-plan best">
            <span className="plan-badge">Best value · save ₹{prices.monthly * 12 - prices.yearly}</span>
            <span className="muted">Yearly</span>
            <b>₹{prices.yearly}</b>
            <span className="muted small">per year</span>
          </Link>
        </div>
        <ul className="ml-list">
          <li>
            <Icon name="check" size={16} /> Your own link: <b>/your-name</b>
          </li>
          <li>
            <Icon name="check" size={16} /> Easy admin panel with your own login
          </li>
          <li>
            <Icon name="check" size={16} /> Pay simply with PhonePe, Paytm or any UPI app
          </li>
          <li>
            <Icon name="check" size={16} /> Change your password anytime
          </li>
        </ul>
        <Link href="/join?plan=yearly" className="btn btn-primary btn-lg ml-cta">
          Get my portfolio
        </Link>
      </section>

      <footer className="ml-foot">
        <span className="rm-word">
          <b>Reuse</b>Me
        </span>
        <span className="muted small">Made by {ownerName}</span>
        <Link href="/privacy" className="muted small">
          Privacy policy
        </Link>
      </footer>
    </div>
  );
}

/** The signed-in person's photo (or initials) and first name; tap for their dashboard or to sign out. */
function AccountMenu({ account }: { account: NonNullable<AccountSummary> }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const first = account.name.trim().split(/\s+/)[0];
  const initials = account.name.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join('') || '?';

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.reload();
  };

  return (
    <div className="ml-account" ref={box}>
      <button type="button" className="ml-account-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" title={account.email}>
        {account.picture && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ml-avatar" src={account.picture} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <span className="ml-avatar ml-avatar-initials" aria-hidden="true">
            {initials}
          </span>
        )}
        <span className="ml-account-name">{first}</span>
        <Icon name="chevron" size={14} className="ml-account-chev" />
      </button>
      {open && (
        <div className="ml-account-menu" role="menu">
          <div className="ml-account-who">
            <b>{account.name}</b>
            <span className="muted small">{account.email}</span>
          </div>
          <Link href={account.home} role="menuitem">
            <Icon name={account.home === '/admin' ? 'settings' : 'file'} size={16} /> {account.homeLabel}
          </Link>
          <button type="button" role="menuitem" onClick={signOut}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
