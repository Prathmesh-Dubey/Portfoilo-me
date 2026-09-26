import { editableTenant } from '@/lib/auth';
import { isUploadType, looksLike, saveUpload } from '@/lib/store';

const MAX_BYTES = 4 * 1024 * 1024; // hosts like Vercel reject request bodies over ~4.5 MB

// Project screenshots for the signed-in user's portfolio. Returns { url } to put in the project's images list.
export async function POST(request: Request) {
  const t = await editableTenant();
  if (t === null) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'No file received' }, { status: 400 });
  if (!isUploadType(file.type)) return Response.json({ error: 'Use a JPG, PNG or WebP image' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'Image must be under 4 MB' }, { status: 400 });
  const data = Buffer.from(await file.arrayBuffer());
  if (!looksLike(data, file.type)) return Response.json({ error: 'That file is not a valid image' }, { status: 400 });
  try {
    return Response.json({ url: await saveUpload(data, file.type, t) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
