import { APK_URL } from '@/lib/links';

// Short, shareable link to the Android app: /download → the newest ReuseMe.apk on GitHub, so opening it starts
// the download straight away. ("download" is a reserved slug in lib/members.ts, so no member page can take it.)
export function GET() {
  return Response.redirect(APK_URL, 302);
}
