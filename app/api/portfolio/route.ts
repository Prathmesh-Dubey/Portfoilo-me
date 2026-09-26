import { revalidatePath } from 'next/cache';
import { currentUser, editableTenant } from '@/lib/auth';
import { publicView, readPortfolio, writePortfolio } from '@/lib/store';
import { readableTenant } from '@/lib/tenant';

// GET  /api/portfolio[?u=slug] → public content (full content when you're signed in to that portfolio)
// PUT  /api/portfolio          → save the signed-in user's own portfolio
export async function GET(request: Request) {
  const t = await readableTenant(request);
  if (t === null) return Response.json({ error: 'Not found' }, { status: 404 });
  const data = await readPortfolio(t);
  const me = await currentUser();
  return Response.json(me?.tenant === t ? data : publicView(data));
}

export async function PUT(request: Request) {
  const t = await editableTenant();
  if (t === null) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  // Refuse saves made from an out-of-date copy (e.g. a second tab), so newer changes are never overwritten.
  const current = await readPortfolio(t);
  if (String(body.updatedAt ?? '') !== current.updatedAt) {
    return Response.json({ error: 'conflict', current }, { status: 409 });
  }
  try {
    const saved = await writePortfolio(body, t);
    revalidatePath(t ? `/${t}` : '/');
    return Response.json(saved);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
