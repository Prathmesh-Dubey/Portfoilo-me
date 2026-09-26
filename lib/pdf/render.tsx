import 'server-only';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { renderToBuffer } from '@react-pdf/renderer';
import type { Portfolio } from '../types';
import { readPhoto } from '../store';
import { ClassicResume } from './ClassicResume';
import { CreativeResume } from './CreativeResume';
import { registerFonts, type Photo } from './shared';

export type ResumeResult = { pdf: Buffer; pages: number; scale: number };
type Rendered = { pdf: Buffer; scale: number };

const MIN_SCALE = 0.78;
const MAX_SCALE = 1.1;
const PAGE_HEIGHT = { Letter: 792, A4: 841.89 } as const;
// Page padding (pt) used by each template — must match the Page styles in CreativeResume / ClassicResume.
const PADDING = { creative: { top: 28, bottom: 26 }, classic: { top: 30, bottom: 28 } } as const;

const countPages = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;

// Recently rendered PDFs, so switching back to a template (or re-downloading) is instant.
const cache = new Map<string, ResumeResult>();
const CACHE_SIZE = 24;

/**
 * Renders the resume PDF straight from the data — the same bytes are used for the preview and the download,
 * so what you preview is exactly what people get.
 *
 * "Fit on one page" finds the largest type scale (78% – 110%) that still fits one page. Rather than blindly
 * bisecting (≈8 full renders), it measures how far down the page the text actually reaches and jumps straight
 * to the right size, then verifies — usually 2–3 renders.
 */
export async function renderResume(d: Portfolio, tenant = ''): Promise<ResumeResult> {
  registerFonts();
  const raw = d.settings.resume.showPhoto && d.profile.photo ? await readPhoto(tenant) : null;
  const photo: Photo = raw ? { data: raw.data, format: raw.type === 'image/png' ? 'png' : 'jpg' } : null;

  const key = crypto.createHash('sha1').update(JSON.stringify({ ...d, updatedAt: '' })).update(raw?.data ?? '').digest('hex');
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // refresh LRU position
    cache.set(key, hit);
    return hit;
  }

  const r = d.settings.resume;
  const Doc = r.template === 'classic' ? ClassicResume : CreativeResume;
  const make = async (scale: number) => Buffer.from(await renderToBuffer(<Doc data={d} scale={scale} photo={photo} />));

  let pdf: Buffer = await make(1);
  let scale = 1;
  if (r.fitOnePage) ({ pdf, scale } = await fitOnePage(pdf, make, PAGE_HEIGHT[r.paper], PADDING[r.template]));

  const result = { pdf, pages: countPages(pdf), scale };
  cache.set(key, result);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return result;
}

async function fitOnePage(first: Buffer, make: (s: number) => Promise<Buffer>, pageH: number, pad: { top: number; bottom: number }): Promise<Rendered> {
  const room = pageH - pad.top - pad.bottom; // usable height on one page
  const round = (s: number) => Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)) * 1000) / 1000;

  let best: Rendered | null = null;
  const tried = new Map<number, boolean>(); // scale → fits one page
  let current: Rendered = { pdf: first, scale: 1 };

  for (let step = 0; step < 5; step++) {
    const pages = countPages(current.pdf);
    const fits = pages === 1;
    tried.set(current.scale, fits);
    if (fits && (!best || current.scale > best.scale)) best = current;

    // How much vertical space the content uses, in page-heights of `room`.
    const used = measureUsedHeight(current.pdf, pageH, pad.top);
    if (used === null) break; // couldn't measure: fall back to bisection below
    const fill = used / room;
    if (fits && (fill > 0.975 || current.scale >= MAX_SCALE)) break; // snug enough

    // Content height grows roughly with the square of the type scale (bigger text → more lines, each taller).
    let next = round(current.scale * Math.sqrt(0.985 / fill));
    // Never retry a scale we already know the answer to; keep moving in the right direction.
    const knownFit = Math.max(MIN_SCALE - 1, ...[...tried].filter(([, f]) => f).map(([s]) => s));
    const knownOverflow = Math.min(MAX_SCALE + 1, ...[...tried].filter(([, f]) => !f).map(([s]) => s));
    if (next <= knownFit || next >= knownOverflow) next = round((Math.max(knownFit, MIN_SCALE) + Math.min(knownOverflow, MAX_SCALE)) / 2);
    if (tried.has(next) || Math.abs(next - current.scale) < 0.004) break;
    current = { pdf: await make(next), scale: next };
  }

  // Safety net: if nothing fitted yet, try the smallest size, then bisect a little.
  if (!best) {
    const smallest = await make(MIN_SCALE);
    if (countPages(smallest) !== 1) return { pdf: first, scale: 1 }; // too long even at 78%: let it flow onto page 2
    best = { pdf: smallest, scale: MIN_SCALE };
    let lo = MIN_SCALE;
    let hi = Math.min(...[...tried].filter(([, f]) => !f).map(([s]) => s), 1);
    for (let i = 0; i < 4 && hi - lo > 0.01; i++) {
      const mid = round((lo + hi) / 2);
      const out = await make(mid);
      if (countPages(out) === 1) {
        best = { pdf: out, scale: mid };
        lo = mid;
      } else hi = mid;
    }
  }
  return best;
}

/**
 * How far down the content reaches, measured from the top padding, summed across pages
 * (e.g. 1.3 pages of content → room * 1.3). Reads text positions from the PDF's content streams by tracking the
 * graphics transform (q/Q/cm) and text matrix (Tm). Returns null if the PDF can't be read.
 */
function measureUsedHeight(pdf: Buffer, pageH: number, padTop: number): number | null {
  try {
    const src = pdf.toString('latin1');
    const bottoms: number[] = []; // per page: lowest text position, distance from page top
    const re = /stream\r?\n/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const start = m.index + m[0].length;
      const end = src.indexOf('endstream', start);
      let text: string;
      try {
        text = zlib.inflateSync(pdf.subarray(start, end)).toString('latin1');
      } catch {
        continue; // not a compressed stream
      }
      if (!/\bTm\b/.test(text) || !/\bBT\b/.test(text)) continue; // not page content
      const lowest = lowestTextY(text);
      if (lowest !== null) bottoms.push(pageH - lowest);
    }
    if (!bottoms.length) return null;
    const room = pageH; // each full extra page adds a whole page of height
    const last = bottoms[bottoms.length - 1];
    return (bottoms.length - 1) * room + (last - padTop);
  } catch {
    return null;
  }
}

type M = [number, number, number, number, number, number];
const mul = (a: M, b: M): M => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4],
  a[4] * b[1] + a[5] * b[3] + b[5],
];

/** Lowest y (PDF user space, origin bottom-left) at which a line of text starts in one content stream. */
function lowestTextY(content: string): number | null {
  let ctm: M = [1, 0, 0, 1, 0, 0];
  const stack: M[] = [];
  let nums: number[] = [];
  let lowest: number | null = null;
  let fontSize = 0;
  for (const tok of content.split(/\s+/)) {
    if (!tok) continue;
    const n = Number(tok);
    if (tok !== '' && !Number.isNaN(n)) {
      nums.push(n);
      continue;
    }
    switch (tok) {
      case 'q':
        stack.push(ctm);
        break;
      case 'Q':
        ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
        break;
      case 'cm':
        if (nums.length >= 6) ctm = mul(nums.slice(-6) as M, ctm);
        break;
      case 'Tf':
        if (nums.length >= 1) fontSize = nums[nums.length - 1];
        break;
      case 'Tm': {
        if (nums.length < 6) break;
        const t = mul(nums.slice(-6) as M, ctm);
        // text origin sits at the top of the line box here; the glyphs extend ~1 font size below it
        const y = t[5] - Math.abs(fontSize * t[3]);
        if (lowest === null || y < lowest) lowest = y;
        break;
      }
    }
    nums = [];
  }
  return lowest;
}

export function resumeFileName(d: Portfolio) {
  const base = (d.profile.name || 'Resume').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return `${base}-Resume.pdf`;
}
