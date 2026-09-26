/**
 * App launch animation: "Reuse" (white) + "Me" (matte black).
 * Pure CSS, so it plays before any JavaScript loads. It shows on every app launch and once per browser session
 * (an inline script in the layout adds `no-splash` to <html> on repeat views, which hides it before paint).
 */
export function Splash() {
  return (
    <div className="splash" aria-hidden="true">
      <div className="splash-inner">
        <div className="splash-word">
          <span className="splash-reuse">
            {'Reuse'.split('').map((c, i) => (
              <span key={i} style={{ '--i': i } as React.CSSProperties}>
                {c}
              </span>
            ))}
          </span>
          <span className="splash-me">
            Me
            <svg className="splash-spark" viewBox="-13 -13 26 26" aria-hidden="true">
              <path d="M0 -13 C1.6 -4 4 -1.6 13 0 C4 1.6 1.6 4 0 13 C-1.6 4 -4 1.6 -13 0 C-4 -1.6 -1.6 -4 0 -13 Z" />
            </svg>
          </span>
        </div>
        <span className="splash-line" />
        <p className="splash-tag">Build · Reuse · Get hired</p>
      </div>
    </div>
  );
}
