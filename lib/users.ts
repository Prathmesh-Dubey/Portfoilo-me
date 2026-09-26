import 'server-only';
import crypto from 'node:crypto';
import { col } from './db';
import { normEmail, isEmail } from './members';
import { hashPassword, newSalt } from './password';

// Free accounts: anyone can sign up (email code or Google) to keep their resume-builder draft on this site.
// They get no portfolio and no admin access. Accounts are in the `users` collection (_id = id), drafts in `resumes`
// (_id derived from the email, so a free user who later becomes a paid member keeps their draft).

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

type UserDoc = Omit<AppUser, 'id'> & { _id: string };
type ResumeDoc = { _id: string; draft: unknown; at: Date };

const MAX_RESUME_BYTES = 200_000;
const users = () => col<UserDoc>('users');
const resumes = () => col<ResumeDoc>('resumes');
const toUser = ({ _id, ...u }: UserDoc): AppUser => ({ id: _id, ...u });
const draftId = (email: string) => crypto.createHash('sha256').update(normEmail(email)).digest('hex').slice(0, 24);

export const listUsers = async () => (await (await users()).find().sort({ createdAt: -1 }).toArray()).map(toUser);
export async function findUserByEmail(email: string) {
  const u = await (await users()).findOne({ email: normEmail(email) });
  return u ? toUser(u) : null;
}

/** Creates a free account (or returns the existing one for this email). */
export async function createUser(input: { name: string; email: string; salt?: string; hash?: string; provider: AppUser['provider'] }): Promise<AppUser> {
  const email = normEmail(input.email);
  if (!isEmail(email)) throw new Error('Enter a valid email address');
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  const doc: UserDoc = {
    _id: crypto.randomBytes(8).toString('hex'),
    name: input.name.trim().slice(0, 80) || email.split('@')[0],
    email,
    salt: input.hash ? input.salt || '' : '',
    hash: input.hash || '',
    provider: input.provider,
    createdAt: new Date().toISOString(),
  };
  try {
    await (await users()).insertOne(doc);
  } catch (e) {
    // two sign-ups for the same email at once: the unique index keeps just one
    if ((e as { code?: number }).code === 11000) return (await findUserByEmail(email))!;
    throw e;
  }
  return toUser(doc);
}

export async function setUserPassword(email: string, password: string) {
  const salt = newSalt();
  const r = await (await users()).updateOne({ email: normEmail(email) }, { $set: { salt, hash: hashPassword(password, salt) } });
  if (!r.matchedCount) throw new Error('No such account');
}

export async function touchUser(email: string) {
  await (await users()).updateOne({ email: normEmail(email) }, { $set: { lastLoginAt: new Date().toISOString() } });
}

/** Removes a free account. `keepResume` is used when the account was upgraded to a paid member. */
export async function deleteUser(id: string, keepResume = false) {
  const u = await (await users()).findOneAndDelete({ _id: String(id) });
  if (!u) throw new Error('No such account');
  if (!keepResume) await (await resumes()).deleteOne({ _id: draftId(u.email) });
}

// ---------- the account's saved resume-builder draft ----------

export async function readUserResume(email: string): Promise<unknown> {
  return (await (await resumes()).findOne({ _id: draftId(email) }))?.draft ?? null;
}

export async function writeUserResume(email: string, draft: unknown) {
  if (JSON.stringify(draft).length > MAX_RESUME_BYTES) throw new Error('This resume is too large to save');
  await (await resumes()).replaceOne({ _id: draftId(email) }, { draft, at: new Date() }, { upsert: true });
}

// ---------- profile photos from Google sign-in (any account type; keyed by email) ----------

type AvatarDoc = { _id: string; picture: string; at: Date };
const avatars = () => col<AvatarDoc>('avatars');

export async function saveAvatar(email: string, picture: string) {
  if (picture) await (await avatars()).replaceOne({ _id: normEmail(email) }, { picture, at: new Date() }, { upsert: true });
}

export async function readAvatar(email: string): Promise<string> {
  return (await (await avatars()).findOne({ _id: normEmail(email) }))?.picture ?? '';
}

/** For the owner's admin panel (no password hashes). */
export const usersOverview = async () =>
  (await listUsers()).map((u) => ({ id: u.id, name: u.name, email: u.email, provider: u.provider, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || '' }));

