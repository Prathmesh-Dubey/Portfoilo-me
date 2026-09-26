import { adminEmail, clientIp, isAdmin, limited } from '@/lib/auth';
import { sendMail } from '@/lib/mail';
import { addSuggestion, deleteSuggestion, readSuggestions } from '@/lib/store';

const clip = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// Visitors send suggestions; they land in the admin Inbox and (if email is set up) in your Gmail.
export async function POST(request: Request) {
  if (limited(`suggest:${clientIp(request)}`, 5, 60 * 60 * 1000)) {
    return Response.json({ error: 'Thanks! You have sent a few already. Please try again later.' }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  if (body.website) return Response.json({ ok: true }); // honeypot: bots fill this hidden field, people never see it
  const name = clip(body.name, 80);
  const email = clip(body.email, 120);
  const message = clip(body.message, 3000);
  if (message.length < 3) return Response.json({ error: 'Please write your suggestion' }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'That email address looks wrong' }, { status: 400 });

  try {
    addSuggestion({ name, email, message });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
  sendMail(
    adminEmail(),
    `New suggestion on your portfolio${name ? ` from ${name}` : ''}`,
    `${message}\n\n- ${name || 'Anonymous'}${email ? ` <${email}>` : ''}`,
    email || undefined,
  ).catch((e) => console.error('Suggestion email failed:', e));
  return Response.json({ ok: true });
}

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: 'Not signed in' }, { status: 401 });
  return Response.json(readSuggestions());
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: 'Not signed in' }, { status: 401 });
  deleteSuggestion(new URL(request.url).searchParams.get('id') || '');
  return Response.json(readSuggestions());
}
