import { currentUser } from '@/lib/auth';
import { readUserResume, writeUserResume } from '@/lib/users';

// The resume-builder draft of a signed-in free user or member, so it follows them to any device.
// (The owner's resume comes from the portfolio itself.)
// GET → { draft } (null if nothing saved yet)   PUT { draft } → save
export async function GET() {
  const me = await currentUser();
  if (!me || me.role === 'owner') return Response.json({ error: 'Not signed in' }, { status: 401 });
  return Response.json({ draft: readUserResume(me.email) });
}

export async function PUT(request: Request) {
  const me = await currentUser();
  if (!me || me.role === 'owner') return Response.json({ error: 'Not signed in' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.draft !== 'object' || !body.draft?.basics) return Response.json({ error: 'Invalid resume' }, { status: 400 });
  try {
    writeUserResume(me.email, body.draft);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  return Response.json({ ok: true });
}
