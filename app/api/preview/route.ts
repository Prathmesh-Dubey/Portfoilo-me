import { readPortfolio } from '@/lib/store';
import { readableTenant } from '@/lib/tenant';

// Preview image for a project card, without storing anything:
//  - the project's live/deployed URL -> a screenshot of that site's front page (thum.io)
//  - its GitHub repo or other link   -> the page's social preview image (og:image)
// Only URLs that appear in the portfolio's own projects are accepted (no open proxy).
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url') || '';
  if (!/^https?:\/\//.test(url)) return new Response('Bad link', { status: 400 });
  const t = await readableTenant(request);
  if (t === null) return new Response('Not found', { status: 404 });
  const projects = readPortfolio(t).projects;

  if (projects.some((p) => p.demo === url)) {
    return Response.redirect(`https://image.thum.io/get/width/1200/crop/750/noanimate/${url}`, 302);
  }
  const known = projects.some((p) => p.repo === url || p.links.some((l) => l.url === url));
  if (!known) return new Response('Unknown link', { status: 404 });

  const image = await findPreviewImage(url);
  if (!image) return new Response('No preview', { status: 404 });
  return Response.redirect(image, 302);
}

async function findPreviewImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioPreview/1.0)', Accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return null;
    const html = (await res.text()).slice(0, 300_000);
    const meta = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))?.[1] ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'))?.[1];
    const found = meta('og:image') || meta('og:image:url') || meta('twitter:image') || meta('twitter:image:src');
    if (!found) return null;
    const abs = new URL(found.replace(/&amp;/g, '&'), res.url || url).href;
    return /^https?:\/\//.test(abs) ? abs : null;
  } catch {
    return null;
  }
}
