'use client';

import { useEffect, useState } from 'react';
import { gmailCompose } from '@/lib/links';
import { Icon } from '../Icons';

type Suggestion = { id: string; name: string; email: string; message: string; at: string };

/** Admin view of visitor suggestions. */
export function Inbox({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/suggestions')
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error || 'Could not load'))))
      .then(setItems, (e) => setError(e.message));
    document.body.classList.add('no-scroll');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const remove = async (id: string) => {
    if (!confirm('Delete this suggestion?')) return;
    const res = await fetch(`/api/suggestions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) setItems(await res.json());
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal editor" role="dialog" aria-modal="true" aria-label="Suggestions inbox">
        <header className="editor-head">
          <div>
            <h3>Suggestions inbox</h3>
            <p>What visitors sent you from the Suggest section{items ? ` · ${items.length} total` : ''}.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="editor-body">
          {error && <p className="form-error">{error}</p>}
          {!items && !error && <p className="muted">Loading…</p>}
          {items?.length === 0 && (
            <div className="empty">
              <Icon name="inbox" size={30} />
              <p>No suggestions yet. They&apos;ll appear here (and in your Gmail once email is set up).</p>
            </div>
          )}
          <ul className="inbox-list">
            {items?.map((s) => (
              <li key={s.id} className="card inbox-item">
                <div className="inbox-meta">
                  <b>{s.name || 'Anonymous'}</b>
                  {s.email && <span className="muted">{s.email}</span>}
                  <time className="muted" dateTime={s.at}>
                    {new Date(s.at).toLocaleString()}
                  </time>
                </div>
                <p className="inbox-msg">{s.message}</p>
                <div className="row-gap">
                  {s.email && (
                    <a className="btn btn-sm" href={gmailCompose(s.email, 'Re: your suggestion')} target="_blank" rel="noopener noreferrer">
                      <Icon name="mail" size={14} /> Reply in Gmail
                    </a>
                  )}
                  <button className="btn btn-sm danger" onClick={() => remove(s.id)}>
                    <Icon name="trash" size={14} /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
