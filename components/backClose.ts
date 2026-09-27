'use client';

import { useEffect, useRef } from 'react';

/**
 * Makes the phone's back gesture (or Android hardware back, or a mouse "back" button)
 * close whatever's open — a modal, a lightbox, the mobile portfolio preview, the admin
 * "user view" — instead of leaving the page. There's no Escape key on a phone, so this
 * is the mobile equivalent of the Escape-key handlers these overlays already have.
 *
 * Call with `active=true` while the thing is open: this pushes one history entry so the
 * back gesture lands on this page instead of navigating away, and pops it again once the
 * thing closes any other way (X button, Escape, selecting something) so no extra entry is
 * ever left behind for a *later* back-press to trip over.
 *
 * Multiple overlays can be "active" independently (e.g. a project modal opened while the
 * admin is in user-view mode) — a shared stack below makes a single back-press close only
 * the most-recently-opened one, same as the browser's own history would.
 */
type Entry = { id: number; onClose: () => void };
const stack: Entry[] = [];
let nextId = 1;
let listening = false;

function ensureListener() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('popstate', () => {
    stack.pop()?.onClose();
  });
}

export function useBackClose(active: boolean, onClose: () => void) {
  // so the effect below doesn't need `onClose` in its deps and re-fire on every render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    ensureListener();
    const id = nextId++;
    let pushed = false;
    let cancelled = false;
    // Defer the actual pushState past this tick. React dev Strict Mode mounts this
    // effect, cleans it up, and mounts it again — all synchronously, before any
    // microtask runs — purely to catch impure effects. Pushing eagerly here would
    // push twice (once for the throwaway pass, once for the real one) and, worse,
    // the throwaway cleanup's own history.back() would only actually fire later as
    // an async popstate, by which point it'd land on and close the real overlay
    // instead. Waiting a tick means only the surviving (real) mount ever pushes.
    queueMicrotask(() => {
      if (cancelled) return;
      pushed = true;
      stack.push({ id, onClose: () => onCloseRef.current() });
      try {
        history.pushState({ __overlay: id }, '');
      } catch {
        /* sandboxed iframe or similar — back gesture just won't be caught this time */
      }
    });
    return () => {
      cancelled = true;
      if (!pushed) return; // the throwaway Strict Mode pass — nothing was ever pushed
      const i = stack.findIndex((e) => e.id === id);
      if (i !== -1) stack.splice(i, 1);
      // Only step history back if our entry is still the live one — if this cleanup
      // is running because the user actually pressed back, it's already gone.
      if (i !== -1 && history.state?.__overlay === id) {
        history.back();
      }
    };
  }, [active]);
}
