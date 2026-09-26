import 'server-only';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword, newSalt } from './password';
import { normEmail, isEmail } from './members';
import { readJson, writeJson } from './store';

// Free accounts: anyone can sign up (email code or Google) to keep their resume-builder draft on this site.
// They get no portfolio and no admin access. Accounts live in data/users.json, drafts in data/resumes/<draftId>.json
// (keyed by email, so a free user who later becomes a paid member keeps their draft).

export type AppUser = {
  id: string;
  name: string;
  email: string;
  /** empty when the account was created with an email code or Google and never set a password */
  salt: string;
  hash: string;
  provider: 'email' | 'google';
  createdAt: string;
  lastLoginAt?: string;
};

const RESUME_DIR = path.join(process.cwd(), 'data', 'resumes');
const MAX_RESUME_BYTES = 200_000;
const ID_RE = /^[a-f0-9]{16}$/;
const draftFile = (email: string) =>
  path.join(/*turbopackIgnore: true*/ RESUME_DIR, `${crypto.createHash('sha256').update(normEmail(email)).digest('hex').slice(0, 24)}.json`);

export const listUsers = () => readJson<AppUser[]>('users.json', []);
const saveUsers = (u: AppUser[]) => writeJson('users.json', u);
export const findUserByEmail = (email: string) => listUsers().find((u) => u.email === normEmail(email));

/** Creates a free account (or returns the existing one for this email). */
export function createUser(input: { name: string; email: string; salt?: string; hash?: string; provider: AppUser['provider'] }): AppUser {
  const email = normEmail(input.email);
  if (!isEmail(email)) throw new Error('Enter a valid email address');
  const users = listUsers();
  const existing = users.find((u) => u.email === email);
  if (existing) return existing;
  const user: AppUser = {
    id: crypto.randomBytes(8).toString('hex'),
    name: input.name.trim().slice(0, 80) || email.split('@')[0],
    email,
    salt: input.hash ? input.salt || '' : '',
    hash: input.hash || '',
    provider: input.provider,
    createdAt: new Date().toISOString(),
  };
  saveUsers([...users, user]);
  return user;
}

export function setUserPassword(email: string, password: string) {
  const users = listUsers();
  const u = users.find((x) => x.email === normEmail(email));
  if (!u) throw new Error('No such account');
  u.salt = newSalt();
  u.hash = hashPassword(password, u.salt);
  saveUsers(users);
}

export function touchUser(email: string) {
  const users = listUsers();
  const u = users.find((x) => x.email === normEmail(email));
  if (!u) return;
  u.lastLoginAt = new Date().toISOString();
  saveUsers(users);
}

/** Removes a free account. `keepResume` is used when the account was upgraded to a paid member. */
export function deleteUser(id: string, keepResume = false) {
  if (!ID_RE.test(id)) throw new Error('No such account');
  const users = listUsers();
  const u = users.find((x) => x.id === id);
  if (!u) throw new Error('No such account');
  saveUsers(users.filter((x) => x.id !== id));
  if (!keepResume) fs.rmSync(draftFile(u.email), { force: true });
}

// ---------- the user's saved resume-builder draft ----------

export function readUserResume(email: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(draftFile(email), 'utf8'));
  } catch {
    return null;
  }
}

export function writeUserResume(email: string, draft: unknown) {
  const text = JSON.stringify(draft);
  if (text.length > MAX_RESUME_BYTES) throw new Error('This resume is too large to save');
  fs.mkdirSync(RESUME_DIR, { recursive: true });
  const file = draftFile(email);
  fs.writeFileSync(file + '.tmp', text);
  fs.renameSync(file + '.tmp', file);
}

/** For the owner's admin panel (no password hashes). */
export const usersOverview = () =>
  listUsers().map((u) => ({ id: u.id, name: u.name, email: u.email, provider: u.provider, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || '' }));
