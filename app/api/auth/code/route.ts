import { clientIp, CODE_MINUTES, consumeCode, createCode, homeFor, limited, startSession } from '@/lib/auth';
import { mailConfigured, sendCodeMail } from '@/lib/mail';

// Passwordless sign-in: { action:'send', email } emails a 6-digit code; { action:'verify', email, code } signs in.
// The reply to 'send' never reveals whether the email has an account.
export async function POST(request: Request) {
  const ip = clientIp(request);
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim();

  if (body.action === 'send') {
    if (await limited(`code-send:${ip}`, 6, 15 * 60 * 1000)) return Response.json({ error: 'Too many codes requested. Try again in 15 minutes.' }, { status: 429 });
    const code = await createCode(email, 'login');
    if (code) await sendCodeMail(email, code, 'login', CODE_MINUTES).catch((e) => console.error('Login code email failed:', e));
    return Response.json({
      ok: true,
      message: mailConfigured()
        ? `If this email has a ReuseMe account, a 6-digit code is on its way (valid ${CODE_MINUTES} minutes). Check your inbox and spam.`
        : 'Email is not set up on this server yet, so the code was printed in the server terminal.',
    });
  }

  if (body.action === 'verify') {
    if (await limited(`code-verify:${ip}`, 15, 15 * 60 * 1000)) return Response.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
    if (!(await consumeCode(email, String(body.code ?? ''), 'login'))) return Response.json({ error: 'That code is wrong or has expired' }, { status: 400 });
    const user = await startSession(email);
    return Response.json({ ok: true, to: homeFor(user) });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
