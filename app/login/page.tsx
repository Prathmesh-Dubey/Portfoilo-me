import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Login from '@/components/Login';
import { currentUser, googleClientId, homeFor } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };

// Public sign-in / free sign-up. ?mode=signup opens straight on "Create account".
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await currentUser();
  if (user) redirect(homeFor(user));
  const { mode } = await searchParams;
  return <Login googleClientId={googleClientId()} startWith={mode === 'signup' ? 'signup' : 'login'} />;
}
