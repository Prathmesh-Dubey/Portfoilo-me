import { readResumeUpload } from '@/lib/store';
import { readableTenant } from '@/lib/tenant';

// An uploaded resume PDF, shown inline (used by the Resume Studio preview).
export async function GET(request: Request) {
  const t = await readableTenant(request);
  const pdf = t === null ? null : readResumeUpload(t);
  if (!pdf) return new Response('No uploaded resume', { status: 404 });
  return new Response(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline', 'Cache-Control': 'no-store' },
  });
}
