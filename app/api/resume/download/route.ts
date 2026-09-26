import { renderResume, resumeFileName } from '@/lib/pdf/render';
import { readPortfolio, readResumeUpload } from '@/lib/store';
import { readableTenant } from '@/lib/tenant';

// What the public "Download resume" buttons hit. Serves whichever resume that portfolio's owner chose in the
// Resume Studio: their uploaded PDF, or the one generated from the website (fallback when none is uploaded).
export async function GET(request: Request) {
  const t = await readableTenant(request);
  if (t === null) return Response.json({ error: 'Not found' }, { status: 404 });
  const data = await readPortfolio(t);
  const filename = resumeFileName(data);

  const uploaded = data.settings.resume.source === 'uploaded' ? await readResumeUpload(t) : null;
  if (uploaded) return pdfResponse(uploaded, filename);

  try {
    return pdfResponse((await renderResume(data, t)).pdf, filename);
  } catch (e) {
    console.error('Resume render failed', e);
    return Response.json({ error: 'Could not generate the PDF' }, { status: 500 });
  }
}

const pdfResponse = (pdf: Buffer, filename: string) =>
  new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
