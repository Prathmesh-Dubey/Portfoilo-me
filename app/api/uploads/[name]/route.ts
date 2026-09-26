import { readUpload } from '@/lib/store';
import { readableTenant } from '@/lib/tenant';

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const t = await readableTenant(request);
  const file = t === null ? null : await readUpload((await params).name, t);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { 'Content-Type': file.type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
  });
}
