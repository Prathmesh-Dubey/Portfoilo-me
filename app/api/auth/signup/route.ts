import { clientIp, CODE_MINUTES, completeSignup, createSignupCode, homeFor, limited, startSession } from '@/lib/auth';
import { mailConfigured, sendCodeMail } from '@/lib/mail';
import { isEmail } from '@/lib/members';

// Free sign-up (resume builder only, no admin access):
// { action:'send', name, email, password? } emails a 6-digit code; { action:'verify', email, code } creates the account and signs in.
export async function POST(request: Request) {
  const ip = clientIp(request);
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim();

  if (body.action === 'send') {
    if (body.website) return Response.json({ ok: true, message: '' }); // spam trap
    if (await limited(`signup-send:${ip}`, 6, 15 * 60 * 1000)) return Response.json({ error: 'Too many codes requested. Try again in 15 minutes.' }, { status: 429 });
    const name = String(body.name ?? '').trim();
    if (!name) return Response.json({ error: 'Enter your name' }, { status: 400 });
    if (!isEmail(email)) return Response.json({ error: 'Enter a valid email address' }, { status: 400 });
    try {
      const code = await createSignupCode({ name, email, password: String(body.password ?? '') });
      await sendCodeMail(email, code, 'signup', CODE_MINUTES);
    } catch (e) {
      return Response.json({ error: (e as Error).message || 'Could not send the code' }, { status: 400 });
    }
    return Response.json({
      ok: true,
      message: mailConfigured()
        ? `We sent a 6-digit code to ${email} (valid ${CODE_MINUTES} minutes). Check your inbox and spam.`
        : 'Email is not set up on this server yet, so the code was printed in the server terminal.',
    });
  }

  if (body.action === 'verify') {
    if (await limited(`signup-verify:${ip}`, 15, 15 * 60 * 1000)) return Response.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
    if (!(await completeSignup(email, String(body.code ?? '')))) return Response.json({ error: 'That code is wrong or has expired' }, { status: 400 });
    const user = await startSession(email);
    return Response.json({ ok: true, to: homeFor(user) });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
