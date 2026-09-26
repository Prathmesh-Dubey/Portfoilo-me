import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { col } from './db';
import { findMemberByEmail, isLive, normEmail, setMemberPassword, type Member } from './members';
import { hashPassword, newSalt, safeEqual, verifyPassword } from './password';
import { readPortfolio } from './store';
import { createUser, findUserByEmail, readAvatar, setUserPassword, touchUser, type AppUser } from './users';

// Three kinds of accounts, all in MongoDB:
// - the owner: `accounts` { _id:'owner', email, salt, hash } (created from ADMIN_EMAIL / ADMIN_PASSWORD on first run)
// - members:   `members` (created when the owner approves a UPI payment)
// - users:     `users` (free sign-up; resume builder only, no portfolio and no admin access)
// Owner and members edit only their own portfolio ("tenant"); users have no tenant (null), so every editing API refuses them.
const COOKIE = 'pf_admin';
const TTL_S = 60 * 60 * 24 * 365; // stay signed in (a year) until the person presses Sign out or changes their password
export const MIN_PASSWORD = 6;
export { safeEqual };

type OwnerAccount = { email: string; salt: string; hash: string };
export type User =
  | { role: 'owner'; email: string; tenant: '' }
  | { role: 'member'; email: string; tenant: string; member: Member }
  | { role: 'user'; email: string; tenant: null; user: AppUser };

function secret() {
  const s = process.env.SESSION_SECRET;
  // Without a real secret anyone could forge a sign-in cookie, so a live site refuses to run without one.
  if (!s && process.env.NODE_ENV === 'production') throw new Error('Set SESSION_SECRET (a long random string) in the environment variables');
  return s || 'dev-only-secret-change-me';
}

const accounts = () => col<OwnerAccount & { _id: string }>('accounts');

async function readOwner(): Promise<OwnerAccount> {
  const coll = await accounts();
  const a = await coll.findOne({ _id: 'owner' });
  if (a?.email && a.hash) return { email: a.email, salt: a.salt, hash: a.hash };
  const email = normEmail(process.env.ADMIN_EMAIL || '');
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment variables');
  const salt = newSalt();
  const account = { email, salt, hash: hashPassword(password, salt) };
  await coll.updateOne({ _id: 'owner' }, { $setOnInsert: account }, { upsert: true });
  return account;
}

export const adminEmail = async () => (await readOwner()).email;

/**
 * The account for an email, with its password hash ('' = no password set) and session version
 * (changes when the password changes, which logs out other sessions).
 */
async function accountFor(email: string): Promise<{ user: User; salt: string; hash: string; v: string } | null> {
  const e = normEmail(email);
  if (!e) return null;
  const owner = await readOwner();
  if (safeEqual(e, owner.email)) return { user: { role: 'owner', email: owner.email, tenant: '' }, salt: owner.salt, hash: owner.hash, v: owner.hash.slice(0, 16) };
  const m = await findMemberByEmail(e);
  if (m) return { user: { role: 'member', email: m.email, tenant: m.slug, member: m }, salt: m.salt, hash: m.hash, v: (m.hash || m.uid || '').slice(0, 16) };
  const u = await findUserByEmail(e);
  if (u) return { user: { role: 'user', email: u.email, tenant: null, user: u }, salt: u.salt, hash: u.hash, v: (u.hash || u.id).slice(0, 16) };
  return null;
}

/** Where someone lands after signing in: users go to the resume builder, everyone else to their admin panel. */
export const homeFor = (u: User) => (u.role === 'user' ? '/resume-builder' : '/admin');

export type AccountSummary = { name: string; email: string; picture: string; home: string; homeLabel: string } | null;

/** Name, photo and dashboard link of the signed-in account, for showing in page headers. */
export async function accountSummary(): Promise<AccountSummary> {
  const u = await currentUser();
  if (!u) return null;
  const name = u.role === 'user' ? u.user.name : u.role === 'member' ? u.member.name : (await readPortfolio()).profile.name;
  return {
    name: name || u.email.split('@')[0],
    email: u.email,
    picture: await readAvatar(u.email).catch(() => ''),
    home: homeFor(u),
    homeLabel: u.role === 'user' ? 'My resume builder' : 'Admin panel',
  };
}

export async function checkCredentials(email: string, password: string): Promise<User | null> {
  const acc = await accountFor(email);
  // always hash something so a wrong email takes as long as a wrong password
  const ok = verifyPassword(password, acc?.salt ?? 'x', acc?.hash ?? 'x'.repeat(128));
  return acc && acc.hash && ok ? acc.user : null;
}

export async function setPassword(email: string, password: string) {
  if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
  const acc = await accountFor(email);
  if (!acc) throw new Error('No such account');
  if (acc.user.role === 'member') return setMemberPassword(acc.user.email, password);
  if (acc.user.role === 'user') return setUserPassword(acc.user.email, password);
  const salt = newSalt();
  await (await accounts()).updateOne({ _id: 'owner' }, { $set: { salt, hash: hashPassword(password, salt) } });
}

// ---------- session cookie (tied to that account's password: changing it logs out other sessions) ----------

function sign(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

async function verify(token: string | undefined): Promise<User | null> {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (!safeEqual(mac, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!(data.exp > Date.now()) || typeof data.sub !== 'string') return null;
    const acc = await accountFor(data.sub);
    return acc && data.v === acc.v ? acc.user : null;
  } catch {
    return null;
  }
}

/** The signed-in user (owner, member or free user), or null. */
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
  const acc = await accountFor(email);
  if (!acc) throw new Error('No such account');
  if (acc.user.role === 'user') await touchUser(acc.user.email);
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

// ---------- one-time 6-digit codes emailed to the address ----------
// Used for sign-up, "forgot password" and "email me a login code"; all expire after 5 minutes (MongoDB removes them).

type CodeDoc = { _id: string; hash: string; exp: number; tries: number; expireAt: Date; name?: string; salt?: string; pwHash?: string };
const codes = () => col<CodeDoc>('codes');
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const CODE_MINUTES = 5;
const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

async function storeCode(key: string, code: string, extra: Partial<CodeDoc> = {}) {
  const exp = Date.now() + CODE_MINUTES * 60 * 1000;
  await (await codes()).replaceOne({ _id: key }, { hash: sha(code), exp, tries: 0, expireAt: new Date(exp), ...extra }, { upsert: true });
}

/** Checks a code (max 5 tries); a correct code works once. Returns the stored record when it matches. */
async function takeCode(key: string, code: string): Promise<CodeDoc | null> {
  const coll = await codes();
  const r = await coll.findOneAndUpdate({ _id: key, exp: { $gt: Date.now() }, tries: { $lt: 5 } }, { $inc: { tries: 1 } }, { returnDocument: 'after' });
  if (!r || !safeEqual(sha(String(code).trim()), r.hash)) return null;
  await coll.deleteOne({ _id: key });
  return r;
}

/** Returns a fresh code if `email` belongs to an account (the caller emails it), otherwise null. */
export async function createCode(email: string, purpose: 'reset' | 'login'): Promise<string | null> {
  const acc = await accountFor(email);
  if (!acc) return null;
  const code = newCode();
  await storeCode(`${purpose}:${acc.user.email}`, code);
  return code;
}

export async function consumeCode(email: string, code: string, purpose: 'reset' | 'login'): Promise<boolean> {
  return (await takeCode(`${purpose}:${normEmail(email)}`, code)) !== null;
}

export const createResetCode = (email: string) => createCode(email, 'reset');
export const consumeResetCode = (email: string, code: string) => consumeCode(email, code, 'reset');

/** True if someone (owner, member or user) can sign in with this email. */
export const accountExists = async (email: string) => (await accountFor(email)) !== null;

// ---------- sign-up: a free account, confirmed with a 6-digit code emailed to the address ----------
// Nothing is saved until the code is entered. The password (optional) is hashed straight away, never kept as text.

/** Returns a code to email, or throws if the email already has an account. */
export async function createSignupCode(input: { name: string; email: string; password: string }): Promise<string> {
  const email = normEmail(input.email);
  if (await accountExists(email)) throw new Error('This email already has an account. Sign in instead.');
  if (input.password && input.password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
  const code = newCode();
  const salt = input.password ? newSalt() : '';
  await storeCode(`signup:${email}`, code, { name: input.name, salt, pwHash: input.password ? hashPassword(input.password, salt) : '' });
  return code;
}

/** Checks the sign-up code (max 5 tries) and creates the account. Returns false for a wrong or expired code. */
export async function completeSignup(email: string, code: string): Promise<boolean> {
  const e = normEmail(email);
  const r = await takeCode(`signup:${e}`, code);
  if (!r) return false;
  if (!(await accountExists(e))) await createUser({ name: r.name || '', email: e, salt: r.salt, hash: r.pwHash, provider: 'email' });
  return true;
}

/** A Google-verified email: sign in the matching account, or create a free user account for a new email. */
export async function ensureGoogleAccount(email: string, name: string) {
  if (!(await accountExists(email))) await createUser({ name, email, provider: 'google' });
}

// ---------- Google sign-in (Google Identity Services: only the public Client ID is needed) ----------

export const googleClientId = () => process.env.GOOGLE_CLIENT_ID || '';

// ---------- rate limiting (shared by every server through MongoDB) ----------

type LimitDoc = { _id: string; first: number; count: number; expireAt: Date };

/** true when `key` has used up `max` attempts inside `windowMs`. Counts this call. */
export async function limited(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const coll = await col<LimitDoc>('limits');
  const hit = await coll.findOneAndUpdate({ _id: key, first: { $gt: now - windowMs } }, { $inc: { count: 1 } }, { returnDocument: 'after' });
  if (hit) return hit.count > max;
  await coll.replaceOne({ _id: key }, { first: now, count: 1, expireAt: new Date(now + windowMs) }, { upsert: true });
  return 1 > max;
}
export const clearLimit = async (key: string) => {
  await (await col<LimitDoc>('limits')).deleteOne({ _id: key });
};

export const clientIp = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
