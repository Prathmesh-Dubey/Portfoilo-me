import { revalidatePath } from 'next/cache';
import { editableTenant } from '@/lib/auth';
import { deletePhoto, isPhotoType, looksLike, readPhoto, readPortfolio, writePhoto, writePortfolio } from '@/lib/store';
import { readableTenant } from '@/lib/tenant';

const MAX_BYTES = 4 * 1024 * 1024;

export async function GET(request: Request) {
  const t = await readableTenant(request);
  const photo = t === null ? null : readPhoto(t);
  if (!photo) return new Response('No photo', { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: { 'Content-Type': photo.type, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}

// The profile photo (JPEG or PNG, the formats PDF embeds natively) of the signed-in user's portfolio.
export async function POST(request: Request) {
  const t = await editableTenant();
  if (t === null) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('photo');
  if (!(file instanceof File)) return Response.json({ error: 'No file received' }, { status: 400 });
  if (!isPhotoType(file.type)) return Response.json({ error: 'Please upload a JPG or PNG image' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'Image must be under 4 MB' }, { status: 400 });
  const data = Buffer.from(await file.arrayBuffer());
  if (!looksLike(data, file.type)) return Response.json({ error: 'That file is not a valid image' }, { status: 400 });

  try {
    writePhoto(data, file.type, t);
    const d = readPortfolio(t);
    const saved = writePortfolio({ ...d, profile: { ...d.profile, photo: Date.now().toString(36) } }, t);
    revalidatePath(t ? `/${t}` : '/');
    return Response.json(saved);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE() {
  const t = await editableTenant();
  if (t === null) return Response.json({ error: 'Not signed in' }, { status: 401 });
  try {
    deletePhoto(t);
    const d = readPortfolio(t);
    const saved = writePortfolio({ ...d, profile: { ...d.profile, photo: '' } }, t);
    revalidatePath(t ? `/${t}` : '/');
    return Response.json(saved);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
