'use client';

import { useEffect, useState } from 'react';
import { gmailCompose } from '@/lib/links';
import { useBackClose } from '../backClose';
import { Icon } from '../Icons';

type Payment = {
  id: string;
  ref: string;
  name: string;
  email: string;
  slug: string;
  plan: 'monthly' | 'yearly';
  amount: number;
  utr: string;
  status: 'awaiting' | 'submitted' | 'approved' | 'rejected';
  createdAt: string;
  submittedAt?: string;
};
type Member = { slug: string; name: string; email: string; plan: 'monthly' | 'yearly'; createdAt: string; startedAt: string; expiresAt: string; active: boolean; live: boolean };
type Result = { email: string; slug: string; password: string | null; created?: boolean; message: string; emailed: boolean };
type FreeUser = { id: string; name: string; email: string; provider: 'email' | 'google'; createdAt: string; lastLoginAt: string };
type Overview = { members: Member[]; payments: Payment[]; users: FreeUser[]; mail?: boolean; result?: Result };

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

/** Owner-only: verify UPI payments against your UPI app, then manage member portfolios. */
export function MembersPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<'payments' | 'members' | 'users'>('payments');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useBackClose(true, onClose);

  useEffect(() => {
    fetch('/api/members')
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error || 'Could not load'))))
      .then(setData, (e) => setError(e.message));
    document.body.classList.add('no-scroll');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const act = async (body: object, key: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(key);
    setError('');
    try {
      const res = await fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData((d) => ({ ...json, mail: d?.mail }));
      if (json.result) setResult(json.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const toVerify = data?.payments.filter((p) => p.status === 'submitted' || p.status === 'awaiting') ?? [];
  const rejected = data?.payments.filter((p) => p.status === 'rejected') ?? [];
  const approved = data?.payments.filter((p) => p.status === 'approved').slice(0, 20) ?? [];

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal editor members-panel" role="dialog" aria-modal="true" aria-label="Members">
        <header className="editor-head">
          <div>
            <h3>Members</h3>
            <p>Check each payment in your UPI app (match the amount, the note code and the UTR), then approve it.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>

        <div className="mp-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'payments'} className={tab === 'payments' ? 'on' : ''} onClick={() => setTab('payments')}>
            <span className="tab-full">Payments to verify</span>
            <span className="tab-short">Payments</span>
            {toVerify.length > 0 && <b className="count">{toVerify.length}</b>}
          </button>
          <button role="tab" aria-selected={tab === 'members'} className={tab === 'members' ? 'on' : ''} onClick={() => setTab('members')}>
            Members {data && <span className="muted">({data.members.length})</span>}
          </button>
          <button role="tab" aria-selected={tab === 'users'} className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>
            <span className="tab-full">Free accounts</span>
            <span className="tab-short">Free</span>
            {data && <span className="muted">({data.users.length})</span>}
          </button>
        </div>

        <div className="editor-body">
          {error && <p className="form-error">{error}</p>}
          {!data && !error && <p className="muted">Loading…</p>}

          {result && (
            <div className="card mp-result">
              <b>
                <Icon name="check" size={16} /> {result.created || result.password ? 'Account created' : 'Done'} for {result.email}
              </b>
              {result.password && (
                <p>
                  Login: <code>{result.email}</code> · Password: <code>{result.password}</code> · Site: <code>/{result.slug}</code>
                </p>
              )}
              <p className="muted small">
                {result.emailed ? 'These details were emailed to them automatically.' : 'Email sending isn’t set up, so send these details yourself:'}
              </p>
              <div className="row-gap">
                <a className="btn btn-sm btn-primary" href={gmailCompose(result.email, 'Your ReuseMe portfolio', result.message)} target="_blank" rel="noopener noreferrer">
                  <Icon name="mail" size={14} /> Send via Gmail
                </a>
                <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(result.message)}>
                  <Icon name="copy" size={14} /> Copy message
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setResult(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {data && tab === 'payments' && (
            <>
              {toVerify.length === 0 && <p className="muted">No payments waiting. New ones appear here after people pay on the Join page.</p>}
              <ul className="mp-list">
                {toVerify.map((p) => (
                  <li key={p.id} className="card mp-item">
                    <div className="mp-row">
                      <b>{p.name}</b>
                      <span className={`mp-status ${p.status}`}>{p.status === 'submitted' ? 'Paid, check UPI' : 'Not paid yet'}</span>
                    </div>
                    <div className="mp-grid">
                      <span>Email</span>
                      <b>{p.email}</b>
                      <span>Plan</span>
                      <b>
                        {p.plan === 'yearly' ? 'Yearly' : 'Monthly'} · ₹{p.amount}
                      </b>
                      <span>UPI note</span>
                      <b>
                        <code>{p.ref}</code>
                      </b>
                      <span>UTR</span>
                      <b>{p.utr ? <code>{p.utr}</code> : '-'}</b>
                      <span>Link</span>
                      <b>/{p.slug}</b>
                      <span>Requested</span>
                      <b>{fmt(p.submittedAt || p.createdAt)}</b>
                    </div>
                    <div className="row-gap">
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={busy === p.id}
                        onClick={() => act({ action: 'approve', id: p.id }, p.id, `Approve ₹${p.amount} from ${p.name}? Only do this after you see the money in your UPI app.`)}
                      >
                        <Icon name="check" size={14} /> Approve
                      </button>
                      <button className="btn btn-sm danger" disabled={busy === p.id} onClick={() => act({ action: 'reject', id: p.id }, p.id, `Reject this payment request from ${p.name}?`)}>
                        <Icon name="x" size={14} /> Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {rejected.length > 0 && (
                <>
                  <h4 className="mp-sub">Rejected: approve any time if it was a mistake</h4>
                  <ul className="mp-list">
                    {rejected.map((p) => (
                      <li key={p.id} className="card mp-item mp-rejected">
                        <div className="mp-row">
                          <b>{p.name}</b>
                          <span className="mp-status rejected">Rejected</span>
                        </div>
                        <p className="muted small">
                          {p.email} · {p.plan === 'yearly' ? 'Yearly' : 'Monthly'} ₹{p.amount} · note <code>{p.ref}</code> · UTR {p.utr ? <code>{p.utr}</code> : '-'} · /{p.slug}
                        </p>
                        <div className="row-gap">
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={busy === p.id}
                            onClick={() => act({ action: 'approve', id: p.id }, p.id, `Approve ₹${p.amount} from ${p.name} after all? Their website goes live now.`)}
                          >
                            <Icon name="check" size={14} /> Approve
                          </button>
                          <button className="btn btn-sm" disabled={busy === p.id} onClick={() => act({ action: 'reopen', id: p.id }, p.id)}>
                            <Icon name="cycle" size={14} /> Move back to pending
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {approved.length > 0 && (
                <>
                  <h4 className="mp-sub">Recently approved</h4>
                  <ul className="mp-history">
                    {approved.map((p) => (
                      <li key={p.id}>
                        <span className="mp-status approved">approved</span> {p.name} · ₹{p.amount} · {p.ref} · {p.utr || 'no UTR'}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {data && tab === 'members' && (
            <>
              {data.members.length === 0 && <p className="muted">No members yet.</p>}
              <ul className="mp-list">
                {data.members.map((m) => {
                  const d = daysLeft(m.expiresAt);
                  return (
                    <li key={m.slug} className="card mp-item">
                      <div className="mp-row">
                        <b>{m.name}</b>
                        <span className={`mp-status ${m.live ? 'approved' : 'rejected'}`}>{m.live ? `Live · ${d} day${d === 1 ? '' : 's'} left` : m.active ? 'Expired' : 'Disabled'}</span>
                      </div>
                      <div className="mp-grid">
                        <span>Email</span>
                        <b>{m.email}</b>
                        <span>Website</span>
                        <b>
                          <a href={`/${m.slug}`} target="_blank" rel="noopener noreferrer">
                            /{m.slug}
                          </a>
                        </b>
                        <span>Plan</span>
                        <b>{m.plan === 'yearly' ? 'Yearly' : 'Monthly'}</b>
                        <span>Member since</span>
                        <b>{fmt(m.createdAt)}</b>
                        <span>Valid until</span>
                        <b>{fmt(m.expiresAt)}</b>
                      </div>
                      <div className="row-gap">
                        <button className="btn btn-sm" disabled={busy === m.slug} onClick={() => act({ action: 'renew', slug: m.slug, plan: 'monthly' }, m.slug, `Add 1 month for ${m.name}?`)}>
                          +1 month
                        </button>
                        <button className="btn btn-sm" disabled={busy === m.slug} onClick={() => act({ action: 'renew', slug: m.slug, plan: 'yearly' }, m.slug, `Add 1 year for ${m.name}?`)}>
                          +1 year
                        </button>
                        <button className="btn btn-sm" disabled={busy === m.slug} onClick={() => act({ action: 'reset', slug: m.slug }, m.slug, `Create a new password for ${m.name}?`)}>
                          <Icon name="lock" size={14} /> New password
                        </button>
                        <button
                          className={`btn btn-sm ${m.active ? 'danger' : ''}`}
                          disabled={busy === m.slug}
                          onClick={() => act({ action: 'toggle', slug: m.slug, active: !m.active }, m.slug, m.active ? `Hide ${m.name}'s website?` : `Show ${m.name}'s website again?`)}
                        >
                          {m.active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {data && tab === 'users' && (
            <>
              <p className="muted small">People who signed up for free. They can only use the resume builder (their draft is saved on the site). They can&apos;t edit any portfolio.</p>
              {data.users.length === 0 && <p className="muted">No free accounts yet.</p>}
              <ul className="mp-list">
                {data.users.map((u) => (
                  <li key={u.id} className="card mp-item">
                    <div className="mp-row">
                      <b>{u.name}</b>
                      <span className="mp-status approved">{u.provider === 'google' ? 'Google' : 'Email'}</span>
                    </div>
                    <div className="mp-grid">
                      <span>Email</span>
                      <b>{u.email}</b>
                      <span>Joined</span>
                      <b>{fmt(u.createdAt)}</b>
                      <span>Last sign-in</span>
                      <b>{u.lastLoginAt ? fmt(u.lastLoginAt) : '-'}</b>
                    </div>
                    <div className="row-gap">
                      <button
                        className="btn btn-sm danger"
                        disabled={busy === u.id}
                        onClick={() => act({ action: 'delete-user', id: u.id }, u.id, `Delete ${u.email}'s account and saved resume? This can't be undone.`)}
                      >
                        <Icon name="trash" size={14} /> Delete account
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
