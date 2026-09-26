import { checkCredentials, currentUser, MIN_PASSWORD, setPassword, startSession } from '@/lib/auth';

// Change password while signed in (needs the current one). Works for the owner and for members.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const { current = '', next = '' } = await request.json().catch(() => ({}));
  if (!checkCredentials(user.email, String(current))) return Response.json({ error: 'Current password is wrong' }, { status: 400 });
  if (String(next).length < MIN_PASSWORD) return Response.json({ error: `New password must be at least ${MIN_PASSWORD} characters` }, { status: 400 });
  try {
    setPassword(user.email, String(next));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
  await startSession(user.email); // re-issue this session; any other signed-in device is logged out
  return Response.json({ ok: true });
}
