import path from 'node:path';
import { Font, Svg, Path, Rect, Circle } from '@react-pdf/renderer';
import type { Link, Portfolio, Project } from '../types';

// ---------- fonts (bundled .woff files, so output is identical on every machine) ----------

let registered = false;
export function registerFonts() {
  if (registered) return;
  const f = (name: string) => path.join(process.cwd(), 'lib', 'pdf', 'fonts', name);
  Font.register({
    family: 'Inter',
    fonts: [
      { src: f('inter-latin-400-normal.woff'), fontWeight: 400 },
      { src: f('inter-latin-400-italic.woff'), fontWeight: 400, fontStyle: 'italic' },
      { src: f('inter-latin-500-normal.woff'), fontWeight: 500 },
      { src: f('inter-latin-600-normal.woff'), fontWeight: 600 },
      { src: f('inter-latin-700-normal.woff'), fontWeight: 700 },
    ],
  });
  Font.register({
    family: 'Sora',
    fonts: [
      { src: f('sora-latin-600-normal.woff'), fontWeight: 600 },
      { src: f('sora-latin-700-normal.woff'), fontWeight: 700 },
    ],
  });
  Font.register({
    family: 'Carlito',
    fonts: [
      { src: f('carlito-latin-400-normal.woff'), fontWeight: 400 },
      { src: f('carlito-latin-400-italic.woff'), fontWeight: 400, fontStyle: 'italic' },
      { src: f('carlito-latin-700-normal.woff'), fontWeight: 700 },
      { src: f('carlito-latin-700-italic.woff'), fontWeight: 700, fontStyle: 'italic' },
    ],
  });
  // Never split words with hyphens — resumes read better with whole words.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

// ---------- helpers ----------

export const PAGE_SIZE = { Letter: 'LETTER', A4: 'A4' } as const;

export type Photo = { data: Buffer; format: 'jpg' | 'png' } | null;
export type DocProps = { data: Portfolio; scale: number; photo: Photo };

export const range = (a: string, b: string, sep: string) => [a, b].filter(Boolean).join(sep);
export const pretty = (url: string) =>
  url.replace(/^mailto:|^tel:/i, '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export function selectedProjects(d: Portfolio): Project[] {
  const byId = new Map(d.projects.map((p) => [p.id, p]));
  return d.settings.resume.projectIds.map((id) => byId.get(id)).filter((p): p is Project => Boolean(p));
}

/** Blend a hex colour toward white (t=0 → colour, t=1 → white). */
export function tint(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
/** Darken a hex colour (t=0 → colour, t=1 → black). */
export function shade(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * (1 - t));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// ---------- icons (stroke icons drawn as vectors, crisp at any zoom) ----------

export type IconName = 'pin' | 'phone' | 'mail' | 'linkedin' | 'github' | 'link';

export function iconFor(l: Pick<Link, 'label' | 'url'>): IconName {
  const s = `${l.label} ${l.url}`.toLowerCase();
  return s.includes('linkedin') ? 'linkedin' : s.includes('github') ? 'github' : 'link';
}

export function Icon({ name, size, color }: { name: IconName; size: number; color: string }) {
  const stroke = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'pin' && (
        <>
          <Path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" {...stroke} />
          <Circle cx="12" cy="10" r="2.6" {...stroke} />
        </>
      )}
      {name === 'phone' && <Path d="M5 3h3.5l1.8 4.6-2.3 1.5a11 11 0 0 0 5.9 5.9l1.5-2.3L20 14.5V18a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" {...stroke} />}
      {name === 'mail' && (
        <>
          <Rect x="3" y="5" width="18" height="14" rx="2" {...stroke} />
          <Path d="M3.5 6L12 13l8.5-7" {...stroke} />
        </>
      )}
      {name === 'linkedin' && (
        <>
          <Rect x="3" y="3" width="18" height="18" rx="3" {...stroke} />
          <Path d="M7.5 10v6.5M7.5 7.3v.1M11 16.5V10m0 3.2c0-1.9 1.2-3.2 2.8-3.2s2.7 1.1 2.7 3.2v3.3" {...stroke} />
        </>
      )}
      {name === 'github' && (
        <Path
          d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"
          {...stroke}
        />
      )}
      {name === 'link' && (
        <>
          <Path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" {...stroke} />
          <Path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" {...stroke} />
        </>
      )}
    </Svg>
  );
}
