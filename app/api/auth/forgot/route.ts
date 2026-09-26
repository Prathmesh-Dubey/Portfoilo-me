import { clientIp, CODE_MINUTES, createResetCode, limited } from '@/lib/auth';
import { mailConfigured, sendCodeMail } from '@/lib/mail';

// Step 1 of "forgot password" (owner or member): email a 6-digit OTP to the account's address.
// The reply never reveals whether the email has an account.
export async function POST(request: Request) {
  if (await limited(`forgot:${clientIp(request)}`, 5, 15 * 60 * 1000)) {
    return Response.json({ error: 'Too many requests. Try again in 15 minutes.' }, { status: 429 });
  }
  const { email = '' } = await request.json().catch(() => ({}));
  const addr = String(email).trim();
  const code = await createResetCode(addr);
  if (code) await sendCodeMail(addr, code, 'reset', CODE_MINUTES).catch((e) => console.error('Reset email failed:', e));
  return Response.json({
    ok: true,
    message: mailConfigured()
      ? `If this email has a ReuseMe account, a 6-digit code is on its way (valid ${CODE_MINUTES} minutes). Check your inbox and spam.`
      : 'Email is not set up on this server, so the code was printed in the server terminal.',
  });
}
