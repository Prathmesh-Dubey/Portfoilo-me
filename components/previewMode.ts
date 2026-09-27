'use client';

// Phone home page: MobileLanding's "Preview live portfolio" swaps to the portfolio (CSS
// shows/hides via html.rm-preview), remembered for the visit via sessionStorage. Both
// MobileLanding (the CTA buttons) and Portfolio (the "Back to ReuseMe" bar) toggle this,
// so the DOM-manipulation lives here once, with a subscriber list, so both — and the
// back-gesture handling in MobileLanding — stay in sync.
type Listener = () => void;
const listeners = new Set<Listener>();

export function isPreviewOn(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('rm-preview');
}

export function enterPreview() {
  try {
    sessionStorage.setItem('rm-preview', '1');
  } catch {
    /* private mode */
  }
  document.documentElement.classList.add('rm-preview');
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

export function exitPreview() {
  try {
    sessionStorage.removeItem('rm-preview');
  } catch {
    /* private mode */
  }
  document.documentElement.classList.remove('rm-preview');
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

/** Runs `fn` whenever preview mode is entered or exited, from either component. */
export function onPreviewChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
