import 'server-only';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Binary } from 'mongodb';
import { cache } from 'react';
import { col, OWNER } from './db';
import { normalize, UPLOAD_RE } from './normalize';
import type { Portfolio } from './types';

// Every portfolio is one MongoDB document (see lib/db.ts); its photo, uploaded resume and screenshots are in `files`.
// A "tenant" is '' for the owner or a member's slug.
export type Tenant = string;

const MAX_BACKUPS = 30;
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

const tid = (t: Tenant) => {
  if (!t) return OWNER;
  if (!SLUG_RE.test(t)) throw new Error('Invalid portfolio name');
  return t;
};

type PortfolioDoc = { _id: string; data: Portfolio };
type BackupDoc = { tenant: string; at: Date; data: Portfolio };
type FileDoc = { _id: string; tenant: string; name: string; type: string; data: Binary; at: Date };

const portfolios = () => col<PortfolioDoc>('portfolios');
const backups = () => col<BackupDoc>('backups');
const files = () => col<FileDoc>('files');

export async function tenantExists(t: Tenant) {
  return (await (await portfolios()).countDocuments({ _id: tid(t) }, { limit: 1 })) > 0;
}

/** Cached per request, so the layout, metadata and page share one database read. */
export const readPortfolio = cache(async (t: Tenant = ''): Promise<Portfolio> => {
  const doc = await (await portfolios()).findOne({ _id: tid(t) });
  if (doc) return normalize(doc.data);
  if (!t) return normalize(seedOwner()); // brand-new database: start from the bundled data/portfolio.json
  throw new Error('Portfolio not found');
});

export async function writePortfolio(next: unknown, t: Tenant = ''): Promise<Portfolio> {
  const id = tid(t);
  const clean = { ...normalize(next), updatedAt: new Date().toISOString() };
  const coll = await portfolios();
  const previous = await coll.findOne({ _id: id });
  if (previous) await backup(id, previous.data);
  await coll.replaceOne({ _id: id }, { data: clean }, { upsert: true });
  await pruneUploads(clean, id).catch(() => {});
  return clean;
}

/** Starter portfolio for a new member: their name and email, everything else for them to fill in. */
export function createMemberPortfolio(slug: string, name: string, email: string): Promise<Portfolio> {
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

// ---------- stored files (photo, uploaded resume, screenshots) ----------

async function readFile(t: Tenant, name: string): Promise<{ data: Buffer; type: string } | null> {
  const doc = await (await files()).findOne({ _id: `${tid(t)}:${name}` });
  return doc ? { data: Buffer.from(doc.data.buffer), type: doc.type } : null;
}

async function writeFile(t: Tenant, name: string, type: string, data: Buffer) {
  const id = tid(t);
  await (await files()).replaceOne({ _id: `${id}:${name}` }, { tenant: id, name, type, data: new Binary(data), at: new Date() }, { upsert: true });
}

async function deleteFile(t: Tenant, name: string) {
  await (await files()).deleteOne({ _id: `${tid(t)}:${name}` });
}

// ---------- photo ----------

const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png' } as const;
export type PhotoType = keyof typeof PHOTO_TYPES;
export const isPhotoType = (t: string): t is PhotoType => t in PHOTO_TYPES;

export async function readPhoto(t: Tenant = ''): Promise<{ data: Buffer; type: PhotoType } | null> {
  const f = await readFile(t, 'photo');
  return f && isPhotoType(f.type) ? { data: f.data, type: f.type } : null;
}

export const writePhoto = (data: Buffer, type: PhotoType, t: Tenant = '') => writeFile(t, 'photo', type, data);
export const deletePhoto = (t: Tenant = '') => deleteFile(t, 'photo');

// ---------- uploaded resume PDF ----------

export const readResumeUpload = async (t: Tenant = ''): Promise<Buffer | null> => (await readFile(t, 'resume.pdf'))?.data ?? null;
export const writeResumeUpload = (data: Buffer, t: Tenant = '') => writeFile(t, 'resume.pdf', 'application/pdf', data);
export const deleteResumeUpload = (t: Tenant = '') => deleteFile(t, 'resume.pdf');

// ---------- project screenshots ----------

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

export async function saveUpload(data: Buffer, type: UploadType, t: Tenant = ''): Promise<string> {
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}.${UPLOAD_TYPES[type]}`;
  await writeFile(t, `uploads/${name}`, type, data);
  return `/api/uploads/${name}${t ? `?u=${t}` : ''}`;
}

export async function readUpload(name: string, t: Tenant = ''): Promise<{ data: Buffer; type: string } | null> {
  if (!/^[\w-]+\.(jpg|png|webp)$/.test(name)) return null;
  return readFile(t, `uploads/${name}`);
}

/** Deletes screenshots no project uses any more (after a day, so a just-uploaded image isn't lost before saving). */
async function pruneUploads(d: Portfolio, id: string) {
  const used = d.projects
    .flatMap((p) => p.images)
    .filter((u) => UPLOAD_RE.test(u))
    .map((u) => `${id}:uploads/${u.split('?')[0].split('/').pop()}`);
  await (await files()).deleteMany({ tenant: id, name: /^uploads\//, _id: { $nin: used }, at: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
}

// ---------- backups (last 30 versions of each portfolio) ----------

async function backup(id: string, data: Portfolio) {
  const coll = await backups();
  await coll.insertOne({ tenant: id, at: new Date(), data });
  const old = await coll.find({ tenant: id }, { projection: { _id: 1 } }).sort({ at: -1 }).skip(MAX_BACKUPS).toArray();
  if (old.length) await coll.deleteMany({ _id: { $in: old.map((b) => b._id) } });
}

// ---------- visitor suggestions (owner only) ----------

export type Suggestion = { id: string; name: string; email: string; message: string; at: string };
type SuggestionDoc = Omit<Suggestion, 'id'> & { _id: string };
const suggestions = () => col<SuggestionDoc>('suggestions');

export async function readSuggestions(): Promise<Suggestion[]> {
  const list = await (await suggestions()).find().sort({ at: -1 }).limit(500).toArray();
  return list.map(({ _id, ...s }) => ({ id: _id, ...s }));
}

export async function addSuggestion(s: Omit<Suggestion, 'id' | 'at'>): Promise<Suggestion> {
  const item = { ...s, id: crypto.randomBytes(6).toString('hex'), at: new Date().toISOString() };
  const { id, ...rest } = item;
  await (await suggestions()).insertOne({ _id: id, ...rest });
  return item;
}

export async function deleteSuggestion(id: string) {
  await (await suggestions()).deleteOne({ _id: String(id) });
}

// ---------- first run ----------

function seedOwner(): unknown {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'portfolio.json'), 'utf8'));
  } catch {
    return {};
  }
}
