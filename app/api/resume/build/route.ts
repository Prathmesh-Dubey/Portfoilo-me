import { clientIp, limited } from '@/lib/auth';
import { normalize } from '@/lib/normalize';
import { renderResume, resumeFileName } from '@/lib/pdf/render';

// Public resume builder: visitors post their own details and get a PDF back. Nothing is stored.
export async function POST(request: Request) {
  if (await limited(`build:${clientIp(request)}`, 60, 10 * 60 * 1000)) {
    return Response.json({ error: 'Too many requests. Wait a minute and try again.' }, { status: 429 });
  }
  if (Number(request.headers.get('content-length') || 0) > 200_000) return Response.json({ error: 'Too much content' }, { status: 413 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid data' }, { status: 400 });

  const d = normalize({ ...body, profile: { ...body.profile, photo: '' } });
  d.settings.resume.showPhoto = false;
  d.settings.resume.projectIds = d.projects.slice(0, 3).map((p) => p.id);

  try {
    const { pdf, pages, scale } = await renderResume(d);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${resumeFileName(d)}"`,
        'Cache-Control': 'no-store',
        'X-Resume-Pages': String(pages),
        'X-Resume-Scale': String(scale),
      },
    });
  } catch (e) {
    return Response.json({ error: 'Could not generate the PDF: ' + (e as Error).message }, { status: 500 });
  }
}
