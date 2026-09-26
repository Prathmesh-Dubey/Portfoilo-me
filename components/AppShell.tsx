'use client';

import { useEffect, useState } from 'react';

const SPARK = 'M0 -13 C1.6 -4 4 -1.6 13 0 C4 1.6 1.6 4 0 13 C-1.6 4 -4 1.6 -13 0 C-4 -1.6 -1.6 -4 0 -13 Z';

/**
 * App-level helpers:
 * - registers the service worker (offline screen + cached pages) in production;
 * - shows a small animated pill when the connection drops, and "Back online" when it returns.
 */
export function AppShell() {
  const [state, setState] = useState<'online' | 'offline' | 'back'>('online');

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    let t: ReturnType<typeof setTimeout>;
    const offline = () => {
      clearTimeout(t);
      setState('offline');
    };
    const online = () => {
      setState('back');
      t = setTimeout(() => setState('online'), 2500);
    };
    if (!navigator.onLine) offline();
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      clearTimeout(t);
    };
  }, []);

  if (state === 'online') return null;
  return (
    <div className={`net-pill ${state === 'back' ? 'ok' : ''}`} role="status" aria-live="polite">
      {state === 'offline' ? (
        <>
          <svg className="net-spark" width="18" height="18" viewBox="-13 -13 26 26" aria-hidden="true">
            <path d={SPARK} />
          </svg>
          You&apos;re offline. Showing saved pages, reconnecting…
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M5 12.5 10 17 19 7" />
          </svg>
          Back online
        </>
      )}
    </div>
  );
}
