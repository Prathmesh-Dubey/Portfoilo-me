import 'server-only';
import crypto from 'node:crypto';
import { hashPassword, newSalt } from './password';
import { createMemberPortfolio, readJson, SLUG_RE, tenantExists, writeJson } from './store';

// Paid memberships without a database: data/members.json (accounts) and data/payments.json (UPI payment requests).
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
const RESERVED = new Set(['admin', 'api', 'join', 'resume-builder', 'offline', 'icons', 'manifest', 'login', 'pricing', 'about', 'app', 'www', 'reuseme', 'static', 'sw', 'members', 'status', 'signup', 'account', 'register']);

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

export const listMembers = () => readJson<Member[]>('members.json', []);
const saveMembers = (m: Member[]) => writeJson('members.json', m);
export const findMemberByEmail = (email: string) => listMembers().find((m) => m.email === normEmail(email));
export const findMemberBySlug = (slug: string) => listMembers().find((m) => m.slug === slug);
export const isLive = (m: Member | undefined) => Boolean(m && m.active && new Date(m.expiresAt).getTime() > Date.now());

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

export function slugStatus(slug: string, email = ''): 'ok' | 'invalid' | 'taken' {
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) return 'invalid';
  const owner = findMemberBySlug(slug);
  if (owner && owner.email !== normEmail(email)) return 'taken';
  if (!owner && tenantExists(slug)) return 'taken';
  const pending = listPayments().find((p) => p.slug === slug && (p.status === 'awaiting' || p.status === 'submitted') && p.email !== normEmail(email));
  return pending ? 'taken' : 'ok';
}

export function setMemberPassword(email: string, password: string) {
  const members = listMembers();
  const m = members.find((x) => x.email === normEmail(email));
  if (!m) throw new Error('No such member');
  m.salt = newSalt();
  m.hash = hashPassword(password, m.salt);
  saveMembers(members);
}

export function resetMemberPassword(slug: string) {
  const m = findMemberBySlug(slug);
  if (!m) throw new Error('No such member');
  const password = starterPassword(m.name);
  setMemberPassword(m.email, password);
  return { member: m, password };
}

export function renewMember(slug: string, plan: Plan) {
  const members = listMembers();
  const m = members.find((x) => x.slug === slug);
  if (!m) throw new Error('No such member');
  const base = new Date(Math.max(Date.now(), new Date(m.expiresAt).getTime()));
  m.plan = plan;
  m.expiresAt = addPlanTime(base, plan).toISOString();
  m.active = true;
  saveMembers(members);
  return m;
}

export function setMemberActive(slug: string, active: boolean) {
  const members = listMembers();
  const m = members.find((x) => x.slug === slug);
  if (!m) throw new Error('No such member');
  m.active = active;
  saveMembers(members);
  return m;
}

// ---------- payment requests ----------

export const listPayments = () => readJson<PaymentRequest[]>('payments.json', []);
const savePayments = (p: PaymentRequest[]) => writeJson('payments.json', p);

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newRef = () => 'RM-' + Array.from({ length: 5 }, () => REF_CHARS[crypto.randomInt(REF_CHARS.length)]).join('');

/** Step 1: the visitor tells us who they are before paying; the reference goes into the UPI payment note. */
export function createPaymentRequest(input: { name: string; email: string; slug: string; plan: Plan }) {
  const payments = listPayments();
  // reuse an unfinished request from the same email so refreshing doesn't pile up duplicates
  const existing = payments.find((p) => p.email === input.email && p.status === 'awaiting');
  const req: PaymentRequest = existing
    ? { ...existing, ...input, amount: PRICES[input.plan] }
    : { id: crypto.randomBytes(8).toString('hex'), ref: newRef(), ...input, amount: PRICES[input.plan], utr: '', status: 'awaiting', createdAt: new Date().toISOString() };
  savePayments([req, ...payments.filter((p) => p.id !== req.id)].slice(0, 2000));
  return req;
}

/** Step 3: after paying in their UPI app, the visitor submits the 12-digit UPI transaction ID (UTR). */
export function submitUtr(id: string, email: string, utr: string) {
  const payments = listPayments();
  const p = payments.find((x) => x.id === id && x.email === normEmail(email));
  if (!p) throw new Error('Payment request not found. Please start again.');
  if (p.status === 'approved') return p;
  p.utr = utr;
  p.status = 'submitted';
  p.submittedAt = new Date().toISOString();
  savePayments(payments);
  return p;
}

/**
 * Owner confirms the money arrived: create (or extend) the member account. New accounts get a starter password, unless
 * they already had a free account (`carry`): then they keep its password (if any) and stay signed in.
 */
export function approvePayment(
  id: string,
  carry?: { uid: string; salt: string; hash: string },
): { member: Member; password: string | null; created: boolean; request: PaymentRequest } {
  const payments = listPayments();
  const p = payments.find((x) => x.id === id);
  if (!p) throw new Error('Payment request not found');
  if (p.status === 'approved') throw new Error('Already approved');

  const members = listMembers();
  let member = members.find((m) => m.email === p.email);
  let password: string | null = null;
  const now = new Date();

  if (member) {
    const base = new Date(Math.max(now.getTime(), new Date(member.expiresAt).getTime()));
    member.plan = p.plan;
    member.expiresAt = addPlanTime(base, p.plan).toISOString();
    member.active = true;
  } else {
    if (slugStatus(p.slug, p.email) !== 'ok') throw new Error(`The link /${p.slug} is no longer available. Edit the request's link first.`);
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
    if (!tenantExists(p.slug)) createMemberPortfolio(p.slug, p.name, p.email);
  }
  const created = !members.includes(member);
  if (created) members.push(member);
  saveMembers(members);
  p.status = 'approved';
  p.decidedAt = now.toISOString();
  savePayments(payments);
  return { member, password, created, request: p };
}

export function rejectPayment(id: string) {
  const payments = listPayments();
  const p = payments.find((x) => x.id === id);
  if (!p) throw new Error('Payment request not found');
  p.status = 'rejected';
  p.decidedAt = new Date().toISOString();
  savePayments(payments);
  return p;
}

/** Undo a decision: put a rejected request back in the queue (it can then be approved normally). */
export function reopenPayment(id: string) {
  const payments = listPayments();
  const p = payments.find((x) => x.id === id);
  if (!p) throw new Error('Payment request not found');
  if (p.status === 'approved') throw new Error('Already approved. Use Members → +1 month / +1 year instead.');
  p.status = p.utr ? 'submitted' : 'awaiting';
  delete p.decidedAt;
  savePayments(payments);
  return p;
}

/** Who customers contact if their site isn't live in time (or for a refund). */
export const SUPPORT = {
  whatsapp: (process.env.SUPPORT_WHATSAPP || '919302622997').replace(/\D/g, ''),
  email: process.env.SUPPORT_EMAIL || '',
};

/** Public, minimal status lookup for the /join page (never reveals passwords). */
export function membershipStatus(email: string) {
  const e = normEmail(email);
  const member = findMemberByEmail(e);
  const latest = listPayments().find((p) => p.email === e);
  return {
    member: member ? { slug: member.slug, plan: member.plan, expiresAt: member.expiresAt, live: isLive(member) } : null,
    request: latest ? { id: latest.id, ref: latest.ref, status: latest.status, plan: latest.plan, amount: latest.amount, slug: latest.slug } : null,
  };
}

/** For the owner's Members panel (no password hashes). */
export function membersOverview() {
  return {
    members: listMembers().map((m) => ({
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
    payments: listPayments(),
  };
}
