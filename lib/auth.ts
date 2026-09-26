import 'server-only';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { findMemberByEmail, isLive, normEmail, setMemberPassword, type Member } from './members';
import { hashPassword, newSalt, safeEqual, verifyPassword } from './password';
import { createUser, findUserByEmail, setUserPassword, touchUser, type AppUser } from './users';

// Three kinds of accounts, no database:
// - the owner: data/admin.json { email, salt, hash } (created from ADMIN_EMAIL / ADMIN_PASSWORD on first run)
// - members:   data/members.json (created when the owner approves a UPI payment)
// - users:     data/users.json (free sign-up; resume builder only, no portfolio and no admin access)
// Owner and members edit only their own portfolio ("tenant"); users have no tenant (null), so every editing API refuses them.
const ADMIN_FILE = path.join(process.cwd(), 'data', 'admin.json');
const COOKIE = 'pf_admin';
const TTL_S = 60 * 60 * 24 * 365; // stay signed in (a year) until the person presses Sign out or changes their password
export const MIN_PASSWORD = 6;
export { safeEqual };

type OwnerAccount = { email: string; salt: string; hash: string };
export type User =
  | { role: 'owner'; email: string; tenant: '' }
  | { role: 'member'; email: string; tenant: string; member: Member }
  | { role: 'user'; email: string; tenant: null; user: AppUser };

const secret = () => process.env.SESSION_SECRET || 'dev-only-secret-change-me';

function readOwner(): OwnerAccount {
  try {
    const a = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
    if (a.email && a.salt && a.hash) return a;
  } catch {
    /* fall through to env */
  }
  const email = normEmail(process.env.ADMIN_EMAIL || '');
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local');
  const salt = newSalt();
  const account = { email, salt, hash: hashPassword(password, salt) };
  try {
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(account, null, 2));
  } catch {
    /* read-only host: keep using env values */
  }
  return account;
}

export const adminEmail = () => readOwner().email;

/**
 * The account for an email, with its password hash ('' = no password set) and session version
 * (changes when the password changes, which logs out other sessions).
 */
function accountFor(email: string): { user: User; salt: string; hash: string; v: string } | null {
  const e = normEmail(email);
  const owner = readOwner();
  if (safeEqual(e, owner.email)) return { user: { role: 'owner', email: owner.email, tenant: '' }, salt: owner.salt, hash: owner.hash, v: owner.hash.slice(0, 16) };
  const m = findMemberByEmail(e);
  if (m) return { user: { role: 'member', email: m.email, tenant: m.slug, member: m }, salt: m.salt, hash: m.hash, v: (m.hash || m.uid || '').slice(0, 16) };
  const u = findUserByEmail(e);
  if (u) return { user: { role: 'user', email: u.email, tenant: null, user: u }, salt: u.salt, hash: u.hash, v: (u.hash || u.id).slice(0, 16) };
  return null;
}

/** Where someone lands after signing in: users go to the resume builder, everyone else to their admin panel. */
export const homeFor = (u: User) => (u.role === 'user' ? '/resume-builder' : '/admin');

export function checkCredentials(email: string, password: string): User | null {
  const acc = accountFor(email);
  // always hash something so a wrong email takes as long as a wrong password
  const ok = verifyPassword(password, acc?.salt ?? 'x', acc?.hash ?? 'x'.repeat(128));
  return acc && acc.hash && ok ? acc.user : null;
}

export function setPassword(email: string, password: string) {
  if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
  const acc = accountFor(email);
  if (!acc) throw new Error('No such account');
  if (acc.user.role === 'member') return setMemberPassword(acc.user.email, password);
  if (acc.user.role === 'user') return setUserPassword(acc.user.email, password);
  const owner = readOwner();
  const salt = newSalt();
  fs.writeFileSync(ADMIN_FILE, JSON.stringify({ ...owner, salt, hash: hashPassword(password, salt) }, null, 2));
}

// ---------- session cookie (tied to that account's password: changing it logs out other sessions) ----------

function sign(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token: string | undefined): User | null {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (!safeEqual(mac, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!(data.exp > Date.now()) || typeof data.sub !== 'string') return null;
    const acc = accountFor(data.sub);
    return acc && data.v === acc.v ? acc.user : null;
  } catch {
    return null;
  }
}

/** The signed-in user (owner or member), or null. */
export async function currentUser(): Promise<User | null> {
  return verify((await cookies()).get(COOKIE)?.value);
}

/** True only for the site owner (members, suggestions inbox, owner settings). */
export async function isAdmin() {
  return (await currentUser())?.role === 'owner';
}

/** The portfolio the signed-in user may edit ('' = owner's site, else a member slug), or null if signed out or a free user. */
export async function editableTenant(): Promise<string | null> {
  const u = await currentUser();
  return u ? u.tenant : null;
}

export const memberIsLive = (u: User) => u.role !== 'member' || isLive(u.member);

/** Signs in the account for `email` and returns it. */
export async function startSession(email: string): Promise<User> {
  const acc = accountFor(email);
  if (!acc) throw new Error('No such account');
  if (acc.user.role === 'user') touchUser(acc.user.email);
  (await cookies()).set(COOKIE, sign({ exp: Date.now() + TTL_S * 1000, sub: acc.user.email, v: acc.v }), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== '1',
    path: '/',
    maxAge: TTL_S,
  });
  return acc.user;
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

// ---------- one-time 6-digit codes emailed to the account's address ----------
// Used for "forgot password" and "email me a login code"; both expire after 5 minutes. Kept in memory: no database needed.

type CodePurpose = 'reset' | 'login';
const codes = new Map<string, { hash: string; exp: number; tries: number }>();
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const CODE_MINUTES = 5;
const TTL: Record<CodePurpose, number> = { reset: CODE_MINUTES * 60 * 1000, login: CODE_MINUTES * 60 * 1000 };

/** Returns a fresh code if `email` belongs to an account (the caller emails it), otherwise null. */
export function createCode(email: string, purpose: CodePurpose): string | null {
  const acc = accountFor(email);
  if (!acc) return null;
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  codes.set(`${purpose}:${acc.user.email}`, { hash: sha(code), exp: Date.now() + TTL[purpose], tries: 0 });
  return code;
}

/** Checks a code (max 5 tries); a correct code works once. */
export function consumeCode(email: string, code: string, purpose: CodePurpose): boolean {
  const key = `${purpose}:${normEmail(email)}`;
  const r = codes.get(key);
  if (!r || Date.now() > r.exp || r.tries >= 5) return false;
  r.tries++;
  const ok = safeEqual(sha(String(code).trim()), r.hash);
  if (ok) codes.delete(key);
  return ok;
}

export const createResetCode = (email: string) => createCode(email, 'reset');
export const consumeResetCode = (email: string, code: string) => consumeCode(email, code, 'reset');

/** True if someone (owner, member or user) can sign in with this email. */
export const accountExists = (email: string) => accountFor(email) !== null;

// ---------- sign-up: a free account, confirmed with a 6-digit code emailed to the address ----------
// Nothing is saved until the code is entered. The password (optional) is hashed straight away, never kept as text.

const signups = new Map<string, { code: string; exp: number; tries: number; name: string; salt: string; hash: string }>();

/** Returns a code to email, or throws if the email already has an account. */
export function createSignupCode(input: { name: string; email: string; password: string }): string {
  const email = normEmail(input.email);
  if (accountExists(email)) throw new Error('This email already has an account. Sign in instead.');
  if (input.password && input.password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const salt = input.password ? newSalt() : '';
  signups.set(email, { code: sha(code), exp: Date.now() + CODE_MINUTES * 60 * 1000, tries: 0, name: input.name, salt, hash: input.password ? hashPassword(input.password, salt) : '' });
  return code;
}

/** Checks the sign-up code (max 5 tries) and creates the account. Returns false for a wrong or expired code. */
export function completeSignup(email: string, code: string): boolean {
  const e = normEmail(email);
  const r = signups.get(e);
  if (!r || Date.now() > r.exp || r.tries >= 5) return false;
  r.tries++;
  if (!safeEqual(sha(String(code).trim()), r.code)) return false;
  signups.delete(e);
  if (!accountExists(e)) createUser({ name: r.name, email: e, salt: r.salt, hash: r.hash, provider: 'email' });
  return true;
}

/** A Google-verified email: sign in the matching account, or create a free user account for a new email. */
export function ensureGoogleAccount(email: string, name: string) {
  if (!accountExists(email)) createUser({ name, email, provider: 'google' });
}

// ---------- Google sign-in (Google Identity Services: only the public Client ID is needed) ----------

export const googleClientId = () => process.env.GOOGLE_CLIENT_ID || '';

// ---------- rate limiting (in-memory; resets on restart) ----------

const buckets = new Map<string, { first: number; count: number }>();

/** true when `key` has used up `max` attempts inside `windowMs`. Counts this call. */
export function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  const entry = b && now - b.first < windowMs ? b : { first: now, count: 0 };
  entry.count++;
  buckets.set(key, entry);
  return entry.count > max;
}
export const clearLimit = (key: string) => buckets.delete(key);

export const clientIp = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
