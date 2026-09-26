import { revalidatePath } from 'next/cache';
import { editableTenant } from '@/lib/auth';
import { deleteResumeUpload, readPortfolio, writePortfolio, writeResumeUpload } from '@/lib/store';

const MAX_BYTES = 10 * 1024 * 1024;

// Upload your own resume PDF (signed-in user's portfolio). Replaces any previous one.
export async function POST(request: Request) {
  const t = await editableTenant();
  if (t === null) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'No file received' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'PDF must be under 10 MB' }, { status: 400 });
  const data = Buffer.from(await file.arrayBuffer());
  if (data.subarray(0, 5).toString() !== '%PDF-') return Response.json({ error: 'That file is not a PDF' }, { status: 400 });

  try {
    writeResumeUpload(data, t);
    const d = readPortfolio(t);
    const saved = writePortfolio({ ...d, settings: { ...d.settings, resume: { ...d.settings.resume, uploadedName: file.name || 'resume.pdf' } } }, t);
    revalidatePath(t ? `/${t}` : '/');
    return Response.json(saved);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Remove it; downloads fall back to the website-generated resume.
export async function DELETE() {
  const t = await editableTenant();
  if (t === null) return Response.json({ error: 'Not signed in' }, { status: 401 });
  try {
    deleteResumeUpload(t);
    const d = readPortfolio(t);
    const saved = writePortfolio({ ...d, settings: { ...d.settings, resume: { ...d.settings.resume, uploadedName: '', source: 'generated' } } }, t);
    revalidatePath(t ? `/${t}` : '/');
    return Response.json(saved);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
