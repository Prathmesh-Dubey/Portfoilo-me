import { consumeResetCode, homeFor, MIN_PASSWORD, setPassword, startSession, type User } from '@/lib/auth';

// Step 2 of "forgot password": code + new password.
export async function POST(request: Request) {
  const { email = '', code = '', password = '' } = await request.json().catch(() => ({}));
  if (String(password).length < MIN_PASSWORD) return Response.json({ error: `Password must be at least ${MIN_PASSWORD} characters` }, { status: 400 });
  if (!(await consumeResetCode(String(email), String(code)))) return Response.json({ error: 'That code is wrong or has expired' }, { status: 400 });
  let user: User;
  try {
    await setPassword(String(email), String(password));
    user = await startSession(String(email));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
  return Response.json({ ok: true, to: homeFor(user) });
}
