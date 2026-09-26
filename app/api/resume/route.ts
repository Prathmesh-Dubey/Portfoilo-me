import { renderResume, resumeFileName } from '@/lib/pdf/render';
import { readPortfolio } from '@/lib/store';
import { readableTenant } from '@/lib/tenant';
import type { Portfolio } from '@/lib/types';

// GET /api/resume[?u=slug]            → the website-generated resume, inline (used by the Resume Studio preview)
// GET /api/resume?download=1          → same bytes, as a file download
// GET /api/resume?template=classic    → preview with another template without saving (lets the Studio pre-build
//                                       the other template so switching is instant)
export async function GET(request: Request) {
  const t = await readableTenant(request);
  if (t === null) return Response.json({ error: 'Not found' }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const saved = readPortfolio(t);
  const template = params.get('template');
  const data: Portfolio =
    template === 'classic' || template === 'creative'
      ? { ...saved, settings: { ...saved.settings, resume: { ...saved.settings.resume, template } } }
      : saved;
  try {
    const { pdf, pages, scale } = await renderResume(data, t);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${params.has('download') ? 'attachment' : 'inline'}; filename="${resumeFileName(data)}"`,
        'Cache-Control': 'no-store',
        'X-Resume-Pages': String(pages),
        'X-Resume-Scale': String(scale),
      },
    });
  } catch (e) {
    console.error('Resume render failed', e);
    return Response.json({ error: 'Could not generate the PDF: ' + (e as Error).message }, { status: 500 });
  }
}
