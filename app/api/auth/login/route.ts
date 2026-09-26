import { checkCredentials, clearLimit, clientIp, homeFor, limited, startSession } from '@/lib/auth';

export async function POST(request: Request) {
  const key = `login:${clientIp(request)}`;
  if (limited(key, 10, 15 * 60 * 1000)) return Response.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const user = checkCredentials(String(body.email ?? ''), String(body.password ?? ''));
  if (!user) return Response.json({ error: 'Wrong email or password' }, { status: 401 });
  clearLimit(key);
  await startSession(user.email);
  return Response.json({ ok: true, role: user.role, to: homeFor(user) });
}
