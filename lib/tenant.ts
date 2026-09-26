import 'server-only';
import { currentUser } from './auth';
import { findMemberBySlug, isLive } from './members';
import { SLUG_RE, tenantExists } from './store';

/**
 * Which portfolio a public request (photo, resume, previews…) refers to: `?u=<slug>` for a member, none for the owner.
 * A member's files are public only while their membership is live, but they can always see their own.
 * Returns null when the portfolio doesn't exist or isn't available.
 */
export async function readableTenant(request: Request): Promise<string | null> {
  const u = new URL(request.url).searchParams.get('u') || '';
  if (!u) return '';
  if (!SLUG_RE.test(u) || !tenantExists(u)) return null;
  if (isLive(findMemberBySlug(u))) return u;
  return (await currentUser())?.tenant === u ? u : null;
}
