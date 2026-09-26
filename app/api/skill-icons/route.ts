import { skillIcons } from '@/lib/skillIcons';

// GET /api/skill-icons?n=Python&n=React → { Python: {path, hex}, React: {...} } (null when there's no brand logo).
// Used when the admin adds new skills, so their icons appear without a reload.
export async function GET(request: Request) {
  const names = new URL(request.url).searchParams.getAll('n').slice(0, 100).map((n) => n.slice(0, 120));
  return Response.json(skillIcons(names), { headers: { 'Cache-Control': 'public, max-age=86400' } });
}
