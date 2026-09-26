/**
 * Creative loading state: a little resume that writes itself while an AI sparkle orbits it.
 * Pure CSS (works before/without JavaScript). After ~8s a hint about the connection fades in.
 * The same design is inlined in public/offline.html for when there's no network at all.
 */
export function Loader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <div className="loader-stage" aria-hidden="true">
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
      <div className="loader-msgs" aria-hidden="true">
        <span>Polishing bullet points…</span>
        <span>Aligning the margins…</span>
        <span>Adding a touch of AI…</span>
        <span>Almost there…</span>
      </div>
      <span className="sr-only">{label}…</span>
      <p className="loader-slow">Taking longer than usual. Check your internet connection.</p>
    </div>
  );
}
