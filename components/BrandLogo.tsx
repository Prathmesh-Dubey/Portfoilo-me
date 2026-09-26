/**
 * Brand mark: the PD monogram in front of a resume page with an AI sparkle.
 * Same artwork as the browser-tab icon (app/icon.png). The navbar uses the plain PD tile instead.
 */
const SPARK = 'M0 -13 C1.6 -4 4 -1.6 13 0 C4 1.6 1.6 4 0 13 C-1.6 4 -4 1.6 -13 0 C-4 -1.6 -1.6 -4 0 -13 Z';

export function BrandLogo({ size = 48, initials = 'PD', className = '' }: { size?: number; initials?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={`brand-logo ${className}`} role="img" aria-label={`${initials} logo`}>
      <g transform="rotate(9 76 48)">
        <path d="M50 10 H88 L104 26 V86 a6 6 0 0 1 -6 6 H50 a6 6 0 0 1 -6 -6 V16 a6 6 0 0 1 6 -6 Z" fill="#ffffff" stroke="#c9d1df" strokeWidth="2" />
        <path d="M88 10 V22 a4 4 0 0 0 4 4 H104" fill="#e8ecf3" stroke="#c9d1df" strokeWidth="2" strokeLinejoin="round" />
        <path d={SPARK} transform="translate(62 30) scale(0.72)" fill="#C9A54C" />
        <rect x="73" y="26" width="20" height="4.5" rx="2.25" fill="#0B1F3A" />
        <rect x="73" y="34" width="13" height="4.5" rx="2.25" fill="#c9d1df" />
        <rect x="54" y="48" width="40" height="4.5" rx="2.25" fill="#c9d1df" />
        <rect x="54" y="57" width="32" height="4.5" rx="2.25" fill="#c9d1df" />
      </g>
      <rect x="10" y="46" width="64" height="64" rx="15" fill="#0B1F3A" stroke="#ffffff" strokeWidth="3" />
      <text x="42" y="88.5" textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight="700" fontSize="27" letterSpacing="-1.2" fill="#ffffff">
        {initials}
      </text>
    </svg>
  );
}
