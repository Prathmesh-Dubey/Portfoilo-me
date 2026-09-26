import 'server-only';
import crypto from 'node:crypto';
import { col, plain } from './db';
import { hashPassword, newSalt } from './password';
import { createMemberPortfolio, SLUG_RE, tenantExists } from './store';

// Paid memberships: `members` (accounts, _id = slug) and `payments` (UPI payment requests, _id = id) in MongoDB.
// Payments are made person-to-person over UPI, so the owner confirms each one in the admin panel.

export type Plan = 'monthly' | 'yearly';

export type Member = {
  slug: string;
  name: string;
  email: string;
  salt: string;
  hash: string;
  plan: Plan;
  createdAt: string;
  startedAt: string;
  expiresAt: string;
  active: boolean;
  /** set when this member started as a free account: keeps that account's sign-in sessions valid after the upgrade */
  uid?: string;
};

export type PaymentStatus = 'awaiting' | 'submitted' | 'approved' | 'rejected';
export type PaymentRequest = {
  id: string;
  ref: string;
  name: string;
  email: string;
  slug: string;
  plan: Plan;
  amount: number;
  utr: string;
  status: PaymentStatus;
  createdAt: string;
  submittedAt?: string;
  decidedAt?: string;
};

export const PRICES: Record<Plan, number> = {
  monthly: Number(process.env.PRICE_MONTHLY || 20),
  yearly: Number(process.env.PRICE_YEARLY || 200),
};
export const UPI = { id: process.env.UPI_ID || 'prathmesh.dubey@ptyes', name: process.env.UPI_NAME || 'Prathmesh Dubey' };

// Paths that belong to the app itself and can never be a portfolio link.
const RESERVED = new Set(['admin', 'api', 'join', 'resume-builder', 'offline', 'icons', 'manifest', 'login', 'pricing', 'about', 'app', 'www', 'reuseme', 'static', 'sw', 'members', 'status', 'signup', 'account', 'register', 'live', 'privacy', 'terms']);

export const normEmail = (e: string) => String(e || '').trim().toLowerCase();
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30)
      .replace(/-+$/, '') || 'me'
  );
}

// ---------- members ----------

type MemberDoc = Member & { _id: string };
const members = () => col<MemberDoc>('members');

export const listMembers = async () => (await (await members()).find().sort({ createdAt: 1 }).toArray()).map((m) => plain<Member>(m)!);
export const findMemberByEmail = async (email: string) => plain<Member>(await (await members()).findOne({ email: normEmail(email) }));
export const findMemberBySlug = async (slug: string) => plain<Member>(await (await members()).findOne({ _id: String(slug) }));
export const isLive = (m: Member | null | undefined) => Boolean(m && m.active && new Date(m.expiresAt).getTime() > Date.now());

async function updateMember(filter: { _id: string } | { email: string }, set: Partial<Member>): Promise<Member> {
  const m = await (await members()).findOneAndUpdate(filter, { $set: set }, { returnDocument: 'after' });
  if (!m) throw new Error('No such member');
  return plain<Member>(m)!;
}

export function addPlanTime(from: Date, plan: Plan) {
  const d = new Date(from);
  if (plan === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** Simple starter password like "riya482". Members are told to change it after signing in. */
function starterPassword(name: string) {
  const first = (name.trim().split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 10) || 'member';
  return `${first}${crypto.randomInt(100, 1000)}`;
}

export async function slugStatus(slug: string, email = ''): Promise<'ok' | 'invalid' | 'taken'> {
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) return 'invalid';
  const owner = await findMemberBySlug(slug);
  if (owner && owner.email !== normEmail(email)) return 'taken';
  if (!owner && (await tenantExists(slug))) return 'taken';
  const pending = await (await payments()).findOne({ slug, status: { $in: ['awaiting', 'submitted'] }, email: { $ne: normEmail(email) } });
  return pending ? 'taken' : 'ok';
}

export async function setMemberPassword(email: string, password: string) {
  const salt = newSalt();
  await updateMember({ email: normEmail(email) }, { salt, hash: hashPassword(password, salt) });
}

export async function resetMemberPassword(slug: string) {
  const m = await findMemberBySlug(slug);
  if (!m) throw new Error('No such member');
  const password = starterPassword(m.name);
  await setMemberPassword(m.email, password);
  return { member: m, password };
}

export async function renewMember(slug: string, plan: Plan) {
  const m = await findMemberBySlug(slug);
  if (!m) throw new Error('No such member');
  const base = new Date(Math.max(Date.now(), new Date(m.expiresAt).getTime()));
  return updateMember({ _id: slug }, { plan, expiresAt: addPlanTime(base, plan).toISOString(), active: true });
}

export const setMemberActive = (slug: string, active: boolean) => updateMember({ _id: String(slug) }, { active });

// ---------- payment requests ----------

type PaymentDoc = Omit<PaymentRequest, 'id'> & { _id: string };
const payments = () => col<PaymentDoc>('payments');
const toRequest = ({ _id, ...p }: PaymentDoc): PaymentRequest => ({ id: _id, ...p });

/** Newest first. */
export const listPayments = async () => (await (await payments()).find().sort({ createdAt: -1 }).limit(2000).toArray()).map(toRequest);
export const findPayment = async (id: string) => {
  const p = await (await payments()).findOne({ _id: String(id) });
  return p ? toRequest(p) : null;
};

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newRef = () => 'RM-' + Array.from({ length: 5 }, () => REF_CHARS[crypto.randomInt(REF_CHARS.length)]).join('');

/** Step 1: the visitor tells us who they are before paying; the reference goes into the UPI payment note. */
export async function createPaymentRequest(input: { name: string; email: string; slug: string; plan: Plan }): Promise<PaymentRequest> {
  const coll = await payments();
  // reuse an unfinished request from the same email so refreshing doesn't pile up duplicates
  const existing = await coll.findOne({ email: input.email, status: 'awaiting' });
  if (existing) {
    const updated = await coll.findOneAndUpdate({ _id: existing._id }, { $set: { ...input, amount: PRICES[input.plan] } }, { returnDocument: 'after' });
    return toRequest(updated!);
  }
  const req: PaymentDoc = { _id: crypto.randomBytes(8).toString('hex'), ref: newRef(), ...input, amount: PRICES[input.plan], utr: '', status: 'awaiting', createdAt: new Date().toISOString() };
  await coll.insertOne(req);
  return toRequest(req);
}

/** Step 3: after paying in their UPI app, the visitor submits the 12-digit UPI transaction ID (UTR). */
export async function submitUtr(id: string, email: string, utr: string): Promise<PaymentRequest> {
  const coll = await payments();
  const p = await coll.findOne({ _id: String(id), email: normEmail(email) });
  if (!p) throw new Error('Payment request not found. Please start again.');
  if (p.status === 'approved') return toRequest(p);
  const updated = await coll.findOneAndUpdate({ _id: p._id }, { $set: { utr, status: 'submitted', submittedAt: new Date().toISOString() } }, { returnDocument: 'after' });
  return toRequest(updated!);
}

/**
 * Owner confirms the money arrived: create (or extend) the member account. New accounts get a starter password, unless
 * they already had a free account (`carry`): then they keep its password (if any) and stay signed in.
 */
export async function approvePayment(
  id: string,
  carry?: { uid: string; salt: string; hash: string },
): Promise<{ member: Member; password: string | null; created: boolean; request: PaymentRequest }> {
  const p = await findPayment(id);
  if (!p) throw new Error('Payment request not found');
  if (p.status === 'approved') throw new Error('Already approved');

  const existing = await findMemberByEmail(p.email);
  let member: Member;
  let password: string | null = null;
  const now = new Date();

  if (existing) {
    const base = new Date(Math.max(now.getTime(), new Date(existing.expiresAt).getTime()));
    member = await updateMember({ email: existing.email }, { plan: p.plan, expiresAt: addPlanTime(base, p.plan).toISOString(), active: true });
  } else {
    if ((await slugStatus(p.slug, p.email)) !== 'ok') throw new Error(`The link /${p.slug} is no longer available. Edit the request's link first.`);
    const salt = carry ? carry.salt : newSalt();
    if (!carry) password = starterPassword(p.name);
    member = {
      slug: p.slug,
      name: p.name,
      email: p.email,
      salt,
      hash: carry ? carry.hash : hashPassword(password!, salt),
      ...(carry ? { uid: carry.uid } : {}),
      plan: p.plan,
      createdAt: now.toISOString(),
      startedAt: now.toISOString(),
      expiresAt: addPlanTime(now, p.plan).toISOString(),
      active: true,
    };
    await (await members()).insertOne({ _id: member.slug, ...member });
    if (!(await tenantExists(p.slug))) await createMemberPortfolio(p.slug, p.name, p.email);
  }
  const decidedAt = now.toISOString();
  await (await payments()).updateOne({ _id: p.id }, { $set: { status: 'approved', decidedAt } });
  return { member, password, created: !existing, request: { ...p, status: 'approved', decidedAt } };
}

export async function rejectPayment(id: string) {
  const r = await (await payments()).updateOne({ _id: String(id) }, { $set: { status: 'rejected', decidedAt: new Date().toISOString() } });
  if (!r.matchedCount) throw new Error('Payment request not found');
}

/** Undo a decision: put a rejected request back in the queue (it can then be approved normally). */
export async function reopenPayment(id: string) {
  const p = await findPayment(id);
  if (!p) throw new Error('Payment request not found');
  if (p.status === 'approved') throw new Error('Already approved. Use Members → +1 month / +1 year instead.');
  await (await payments()).updateOne({ _id: p.id }, { $set: { status: p.utr ? 'submitted' : 'awaiting' }, $unset: { decidedAt: '' } });
}

/** Who customers contact if their site isn't live in time (or for a refund). */
export const SUPPORT = {
  whatsapp: (process.env.SUPPORT_WHATSAPP || '919302622997').replace(/\D/g, ''),
  email: process.env.SUPPORT_EMAIL || '',
};

/** Public, minimal status lookup for the /join page (never reveals passwords). */
export async function membershipStatus(email: string) {
  const e = normEmail(email);
  const member = await findMemberByEmail(e);
  const latestDoc = await (await payments()).find({ email: e }).sort({ createdAt: -1 }).limit(1).next();
  const latest = latestDoc ? toRequest(latestDoc) : null;
  return {
    member: member ? { slug: member.slug, plan: member.plan, expiresAt: member.expiresAt, live: isLive(member) } : null,
    request: latest ? { id: latest.id, ref: latest.ref, status: latest.status, plan: latest.plan, amount: latest.amount, slug: latest.slug } : null,
  };
}

/** For the owner's Members panel (no password hashes). */
export async function membersOverview() {
  const [list, pays] = await Promise.all([listMembers(), listPayments()]);
  return {
    members: list.map((m) => ({
      slug: m.slug,
      name: m.name,
      email: m.email,
      plan: m.plan,
      createdAt: m.createdAt,
      startedAt: m.startedAt,
      expiresAt: m.expiresAt,
      active: m.active,
      live: isLive(m),
    })),
    payments: pays,
  };
}
