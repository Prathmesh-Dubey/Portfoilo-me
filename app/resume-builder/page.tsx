import type { Metadata } from 'next';
import ResumeBuilder from '@/components/ResumeBuilder';
import { currentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Free Resume Builder',
  description: 'Create a professional one-page resume and download it as a PDF.',
};

// Anyone can use the builder; signed-in free users and members also get their draft saved on the site.
export default async function Page() {
  const me = await currentUser();
  const account = me?.role === 'user' ? { name: me.user.name, email: me.email } : me?.role === 'member' ? { name: me.member.name, email: me.email } : null;
  return <ResumeBuilder account={account} />;
}
