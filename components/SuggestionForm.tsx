'use client';

import { useState } from 'react';
import { Icon } from './Icons';

/** Public form: visitors send a suggestion straight to the owner (admin Inbox + Gmail when email is set up). */
export function SuggestionForm({ no }: { no: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setState('sending');
    setError('');
    const res = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Could not send. Please try again.');
      setState('idle');
      return;
    }
    formEl.reset();
    setState('sent');
  };

  return (
    <div className="suggest-grid reveal">
      <div>
        <span className="eyebrow">{no} · suggestions</span>
        <h2 className="suggest-title">Have a suggestion for me?</h2>
        <p className="muted">
          Feedback on my projects, an idea, a job lead, or something I could do better — it comes straight to me. Name and email are optional.
        </p>
      </div>

      {state === 'sent' ? (
        <div className="card suggest-card sent">
          <span className="sent-icon">
            <Icon name="check" size={26} />
          </span>
          <h3>Thank you!</h3>
          <p className="muted">Your suggestion reached me. I read every one.</p>
          <button className="btn btn-ghost" onClick={() => setState('idle')}>
            Send another
          </button>
        </div>
      ) : (
        <form className="card suggest-card" onSubmit={submit}>
          <div className="fields">
            <label className="field half">
              <span className="label">Your name</span>
              <input name="name" maxLength={80} autoComplete="name" placeholder="Optional" />
            </label>
            <label className="field half">
              <span className="label">Your email</span>
              <input name="email" type="email" maxLength={120} autoComplete="email" placeholder="Optional, if you'd like a reply" />
            </label>
            <label className="field full">
              <span className="label">Suggestion</span>
              <textarea name="message" rows={4} required minLength={3} maxLength={3000} placeholder="What should I improve, build or know?" />
            </label>
            {/* honeypot: hidden from people, catches bots */}
            <input name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-lg" disabled={state === 'sending'}>
            <Icon name="send" size={17} /> {state === 'sending' ? 'Sending…' : 'Send suggestion'}
          </button>
        </form>
      )}
    </div>
  );
}
