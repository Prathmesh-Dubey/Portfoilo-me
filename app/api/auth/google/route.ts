import { clientIp, ensureGoogleAccount, googleClientId, homeFor, limited, startSession } from '@/lib/auth';
import { verifyGoogleIdToken } from '@/lib/google';
import { saveAvatar } from '@/lib/users';

// "Continue with Google": the Google button hands the browser a signed ID token, which it posts here as { credential }.
// An email that already has an account signs in to it; a new email gets a free (resume builder only) account.
export async function POST(request: Request) {
  const clientId = googleClientId();
  if (!clientId) return Response.json({ error: 'Google sign-in isn’t set up yet' }, { status: 400 });
  if (await limited(`google:${clientIp(request)}`, 20, 15 * 60 * 1000)) return Response.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  const { credential = '' } = await request.json().catch(() => ({}));
  try {
    const { email, name, picture } = await verifyGoogleIdToken(String(credential), clientId);
    await ensureGoogleAccount(email, name);
    await saveAvatar(email, picture).catch(() => {});
    const user = await startSession(email);
    return Response.json({ ok: true, to: homeFor(user) });
  } catch (e) {
    console.error('Google sign-in failed:', e);
    return Response.json({ error: `Couldn’t sign in with Google (${(e as Error).message}). Please try again.` }, { status: 400 });
  }
}
