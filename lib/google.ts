import 'server-only';
import crypto from 'node:crypto';

// "Sign in with Google" via Google Identity Services: the browser gets a signed ID token (JWT) from Google and posts it here.
// We check Google's signature with its public keys, so only the public Client ID is needed (no client secret).
// Google Cloud Console → Credentials → your OAuth client → "Authorised JavaScript origins" must list every address the
// site runs on, e.g. http://localhost, http://localhost:3000 and https://YOUR-DOMAIN.

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
type Jwk = crypto.JsonWebKey & { kid: string };
let keys: { at: number; list: Jwk[] } | null = null;

async function googleKeys(force = false): Promise<Jwk[]> {
  if (!force && keys && Date.now() - keys.at < 60 * 60 * 1000) return keys.list;
  const res = await fetch(CERTS_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not reach Google');
  keys = { at: Date.now(), list: (await res.json()).keys };
  return keys.list;
}

/** Returns the verified Google account for an ID token, or throws. */
export async function verifyGoogleIdToken(token: string, clientId: string): Promise<{ email: string; name: string }> {
  const [h, p, sig] = String(token).split('.');
  if (!h || !p || !sig) throw new Error('Malformed Google token');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  if (header.alg !== 'RS256') throw new Error('Unexpected Google token algorithm');

  let jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await googleKeys(true)).find((k) => k.kid === header.kid); // Google rotates its keys
  if (!jwk) throw new Error('Unknown Google signing key');
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  if (!crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), key, Buffer.from(sig, 'base64url'))) throw new Error('Bad Google signature');

  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  const validIssuer = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  if (!validIssuer || claims.aud !== clientId || !(claims.exp * 1000 > Date.now()) || claims.email_verified !== true || !claims.email) {
    throw new Error('Google did not confirm this email');
  }
  return { email: String(claims.email).toLowerCase(), name: String(claims.name || '') };
}
