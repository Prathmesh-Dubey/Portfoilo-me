import { adminEmail, clientIp, limited } from '@/lib/auth';
import { sendMail } from '@/lib/mail';
import { createPaymentRequest, isEmail, membershipStatus, normEmail, PRICES, slugify, slugStatus, submitUtr, UPI, type Plan } from '@/lib/members';

// Public side of paid memberships.
// GET  ?slug=riya-sharma          → is that portfolio link free?
// GET  ?email=you@gmail.com       → membership / payment status (never reveals passwords)
// POST { action:'start', ... }    → step 1: details before paying (returns a reference for the UPI note)
// POST { action:'submit', ... }   → step 3: UPI transaction ID after paying
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  if (q.has('slug')) {
    const slug = slugify(q.get('slug') || '');
    return Response.json({ slug, status: slugStatus(slug, q.get('email') || '') });
  }
  if (q.has('email')) {
    if (limited(`mstatus:${clientIp(request)}`, 30, 10 * 60 * 1000)) return Response.json({ error: 'Too many requests' }, { status: 429 });
    return Response.json(membershipStatus(q.get('email') || ''));
  }
  return Response.json({ prices: PRICES, upi: UPI });
}

export async function POST(request: Request) {
  if (limited(`membership:${clientIp(request)}`, 20, 60 * 60 * 1000)) {
    return Response.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));

  if (body.action === 'start') {
    const name = String(body.name ?? '').trim().slice(0, 60);
    const email = normEmail(String(body.email ?? ''));
    const plan: Plan = body.plan === 'yearly' ? 'yearly' : 'monthly';
    const slug = slugify(String(body.slug || name));
    if (name.length < 2) return Response.json({ error: 'Please enter your name' }, { status: 400 });
    if (!isEmail(email)) return Response.json({ error: 'Please enter a valid Gmail address' }, { status: 400 });
    const status = slugStatus(slug, email);
    if (status !== 'ok') return Response.json({ error: status === 'taken' ? `/${slug} is already taken. Try another link.` : 'Choose a link with 3–30 letters or numbers.' }, { status: 400 });
    try {
      const req = createPaymentRequest({ name, email, slug, plan });
      return Response.json({ id: req.id, ref: req.ref, amount: req.amount, plan, slug, upi: UPI });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  if (body.action === 'submit') {
    const utr = String(body.utr ?? '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9]{10,22}$/.test(utr)) return Response.json({ error: 'Enter the UPI transaction ID (UTR) from your payment app. It is usually 12 digits.' }, { status: 400 });
    try {
      const p = submitUtr(String(body.id ?? ''), String(body.email ?? ''), utr);
      sendMail(
        adminEmail(),
        `ReuseMe payment to verify: ₹${p.amount} (${p.plan}) from ${p.name}`,
        `${p.name} <${p.email}> says they paid ₹${p.amount} for the ${p.plan} plan.\n\nUPI transaction ID (UTR): ${p.utr}\nPayment note/reference: ${p.ref}\nRequested link: /${p.slug}\n\nCheck your UPI app, then approve it in Admin → Members.`,
        p.email,
      ).catch((e) => console.error('Payment notification failed:', e));
      return Response.json({ ok: true, status: p.status });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
