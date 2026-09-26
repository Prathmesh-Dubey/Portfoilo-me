import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalize, UPLOAD_RE } from './normalize';
import type { Portfolio } from './types';

// No database: every portfolio is a folder of plain files.
//   data/                 → the owner's site (portfolio.json, photo, uploads/, resume.pdf, backups/)
//   data/members/<slug>/  → a member's site, same layout
// A "tenant" is '' for the owner or a member's slug.
export type Tenant = string;

const DATA_DIR = path.join(process.cwd(), 'data');
const MAX_BACKUPS = 30;

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
const dirOf = (t: Tenant) => {
  if (!t) return DATA_DIR;
  if (!SLUG_RE.test(t)) throw new Error('Invalid portfolio name');
  return path.join(/*turbopackIgnore: true*/ DATA_DIR, 'members', t);
};
const fileOf = (t: Tenant, name: string) => path.join(/*turbopackIgnore: true*/ dirOf(t), name);

export const tenantExists = (t: Tenant) => fs.existsSync(fileOf(t, 'portfolio.json'));

export function readPortfolio(t: Tenant = ''): Portfolio {
  return normalize(JSON.parse(fs.readFileSync(fileOf(t, 'portfolio.json'), 'utf8')));
}

export function writePortfolio(next: unknown, t: Tenant = ''): Portfolio {
  const clean = { ...normalize(next), updatedAt: new Date().toISOString() };
  const file = fileOf(t, 'portfolio.json');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    backup(t);
    fs.writeFileSync(file + '.tmp', JSON.stringify(clean, null, 2));
    fs.renameSync(file + '.tmp', file);
  } catch (e) {
    throw storageError(e);
  }
  pruneUploads(clean, t);
  return clean;
}

/** Starter portfolio for a new member: their name and email, everything else for them to fill in. */
export function createMemberPortfolio(slug: string, name: string, email: string): Portfolio {
  return writePortfolio(
    {
      profile: {
        name,
        title: 'Your role | Your specialty',
        tagline: `Hi, I'm ${name.split(' ')[0]}. Edit this in your admin panel to tell visitors what you do.`,
        email,
        available: true,
        showPhoneOnSite: false,
        links: [],
      },
      summary: 'Write a short professional summary here. It appears on your website and your resume PDF.',
      skills: [{ category: 'Skills', items: ['Add your skills'] }],
      settings: { resume: { template: 'creative', paper: 'A4', accent: '#1a365d' }, site: { theme: 'light' } },
    },
    slug,
  );
}

/** What visitors get: same content, minus things the owner chose to hide on the website. */
export function publicView(d: Portfolio): Portfolio {
  return d.profile.showPhoneOnSite ? d : { ...d, profile: { ...d.profile, phone: '' } };
}

// ---------- photo ----------

const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png' } as const;
export type PhotoType = keyof typeof PHOTO_TYPES;
export const isPhotoType = (t: string): t is PhotoType => t in PHOTO_TYPES;

export function readPhoto(t: Tenant = ''): { data: Buffer; type: PhotoType } | null {
  for (const [type, ext] of Object.entries(PHOTO_TYPES)) {
    const file = fileOf(t, `photo.${ext}`);
    if (fs.existsSync(file)) return { data: fs.readFileSync(file), type: type as PhotoType };
  }
  return null;
}

export function writePhoto(data: Buffer, type: PhotoType, t: Tenant = '') {
  try {
    deletePhoto(t);
    fs.writeFileSync(fileOf(t, `photo.${PHOTO_TYPES[type]}`), data);
  } catch (e) {
    throw storageError(e);
  }
}

export function deletePhoto(t: Tenant = '') {
  for (const ext of Object.values(PHOTO_TYPES)) fs.rmSync(fileOf(t, `photo.${ext}`), { force: true });
}

// ---------- uploaded resume PDF ----------

export const readResumeUpload = (t: Tenant = ''): Buffer | null => {
  const f = fileOf(t, 'resume.pdf');
  return fs.existsSync(f) ? fs.readFileSync(f) : null;
};

export function writeResumeUpload(data: Buffer, t: Tenant = '') {
  try {
    fs.writeFileSync(fileOf(t, 'resume.pdf'), data);
  } catch (e) {
    throw storageError(e);
  }
}

export const deleteResumeUpload = (t: Tenant = '') => fs.rmSync(fileOf(t, 'resume.pdf'), { force: true });

// ---------- project screenshots (<tenant dir>/uploads) ----------

const UPLOAD_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
export type UploadType = keyof typeof UPLOAD_TYPES;
export const isUploadType = (t: string): t is UploadType => t in UPLOAD_TYPES;

/** Checks the file really is the image type it claims to be (magic bytes). */
export function looksLike(data: Buffer, type: string) {
  if (type === 'image/jpeg') return data[0] === 0xff && data[1] === 0xd8;
  if (type === 'image/png') return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/webp') return data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
  return false;
}

export function saveUpload(data: Buffer, type: UploadType, t: Tenant = ''): string {
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}.${UPLOAD_TYPES[type]}`;
  try {
    fs.mkdirSync(fileOf(t, 'uploads'), { recursive: true });
    fs.writeFileSync(path.join(/*turbopackIgnore: true*/ fileOf(t, 'uploads'), name), data);
  } catch (e) {
    throw storageError(e);
  }
  return `/api/uploads/${name}${t ? `?u=${t}` : ''}`;
}

export function readUpload(name: string, t: Tenant = ''): { data: Buffer; type: string } | null {
  if (!/^[\w-]+\.(jpg|png|webp)$/.test(name)) return null;
  const file = path.join(/*turbopackIgnore: true*/ fileOf(t, 'uploads'), name);
  if (!fs.existsSync(file)) return null;
  const ext = name.split('.').pop()!;
  const type = Object.entries(UPLOAD_TYPES).find(([, e]) => e === ext)![0];
  return { data: fs.readFileSync(file), type };
}

/** Deletes screenshots no project uses any more (after a day, so a just-uploaded image isn't lost before saving). */
function pruneUploads(d: Portfolio, t: Tenant) {
  try {
    const dir = fileOf(t, 'uploads');
    const used = new Set(d.projects.flatMap((p) => p.images).filter((u) => UPLOAD_RE.test(u)).map((u) => u.split('?')[0].split('/').pop()));
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      const full = path.join(/*turbopackIgnore: true*/ dir, f);
      if (!used.has(f) && Date.now() - fs.statSync(full).mtimeMs > 24 * 60 * 60 * 1000) fs.rmSync(full);
    }
  } catch {
    /* best effort */
  }
}

// ---------- visitor suggestions (owner only: data/suggestions.json) ----------

export type Suggestion = { id: string; name: string; email: string; message: string; at: string };
const SUGGESTIONS_FILE = path.join(DATA_DIR, 'suggestions.json');

export function readSuggestions(): Suggestion[] {
  try {
    return JSON.parse(fs.readFileSync(SUGGESTIONS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeSuggestions(list: Suggestion[]) {
  try {
    fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(list, null, 2));
  } catch (e) {
    throw storageError(e);
  }
}

export function addSuggestion(s: Omit<Suggestion, 'id' | 'at'>): Suggestion {
  const item = { ...s, id: crypto.randomBytes(6).toString('hex'), at: new Date().toISOString() };
  writeSuggestions([item, ...readSuggestions()].slice(0, 500));
  return item;
}

export function deleteSuggestion(id: string) {
  writeSuggestions(readSuggestions().filter((s) => s.id !== id));
}

// ---------- small JSON-file helpers (used by lib/members.ts) ----------

export function readJson<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ DATA_DIR, name), 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(name: string, value: unknown) {
  const file = path.join(/*turbopackIgnore: true*/ DATA_DIR, name);
  try {
    fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2));
    fs.renameSync(file + '.tmp', file);
  } catch (e) {
    throw storageError(e);
  }
}

// ---------- internals ----------

function backup(t: Tenant) {
  const file = fileOf(t, 'portfolio.json');
  if (!fs.existsSync(file)) return;
  const dir = fileOf(t, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(file, path.join(/*turbopackIgnore: true*/ dir, `portfolio-${stamp}.json`));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) fs.rmSync(path.join(/*turbopackIgnore: true*/ dir, f));
}

function storageError(e: unknown) {
  const code = (e as NodeJS.ErrnoException)?.code;
  if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM') {
    return new Error(
      'This server cannot write to its disk (serverless hosts like Vercel are read-only). Run the site with `npm start` on a normal server/VPS, or edit locally and redeploy.',
    );
  }
  return e instanceof Error ? e : new Error(String(e));
}
