'use client';

// Inside the ReuseMe Android app (Capacitor), the page can't download files the usual way, so the app exposes a small
// bridge (window.ReuseMeApp, see android/.../MainActivity.java) that saves them to the phone's Downloads folder and
// runs Android's own Google sign-in (Google blocks its web sign-in inside app WebViews).

type Bridge = { saveFile(base64: string, fileName: string, mimeType: string): void; googleSignIn?(webClientId: string): void };
const bridge = () => (typeof window === 'undefined' ? undefined : (window as unknown as { ReuseMeApp?: Bridge }).ReuseMeApp);

export const inNativeApp = () => Boolean(bridge());

/**
 * How "Continue with Google" works here: Google's web button in browsers; Android's own account picker in the app
 * (Google blocks web sign-in inside app WebViews); none in an old app version that has no native sign-in yet.
 */
export function googleMode(): 'web' | 'native' | 'none' {
  if (bridge()?.googleSignIn) return 'native';
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('ReuseMeApp') ? 'none' : 'web';
}

/** Native Google sign-in in the Android app; resolves with a Google ID token, or rejects with Google's reason. */
export function nativeGoogleSignIn(webClientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { __reuseMeGoogle?: (status: string, value: string) => void };
    w.__reuseMeGoogle = (status, value) => {
      delete w.__reuseMeGoogle;
      // a "cancel" can also be Google refusing a misconfigured app, so its reason is always shown
      if (status === 'ok') resolve(value);
      else reject(new Error(value || (status === 'cancel' ? 'cancelled' : 'Google sign-in failed')));
    };
    bridge()!.googleSignIn!(webClientId);
  });
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Saves a file made in the page: through the app's bridge in the Android app, otherwise a normal browser download. */
export async function saveFile(blob: Blob, fileName: string) {
  const b = bridge();
  if (b) return b.saveFile(await toBase64(blob), fileName, blob.type || 'application/octet-stream');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
