import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Portfolio from '@/components/Portfolio';
import Login from '@/components/Login';
import { currentUser, googleClientId } from '@/lib/auth';
import { isLive } from '@/lib/members';
import { skillIcons } from '@/lib/skillIcons';
import { readPortfolio } from '@/lib/store';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

// One sign-in for everyone: the owner edits the main site, a member edits their own /slug portfolio.
// Free accounts have no portfolio to edit, so they're sent to the resume builder.
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) return <Login googleClientId={googleClientId()} />;
  if (user.role === 'user') redirect('/resume-builder');
  const data = readPortfolio(user.tenant);
  const icons = skillIcons(data.skills.flatMap((g) => g.items));
  if (user.role === 'owner') return <Portfolio initial={data} admin adminEmail={user.email} skillIcons={icons} />;
  const m = user.member;
  return (
    <Portfolio
      initial={data}
      admin
      role="member"
      tenant={m.slug}
      adminEmail={user.email}
      member={{ slug: m.slug, plan: m.plan, expiresAt: m.expiresAt, live: isLive(m), daysLeft: Math.ceil((new Date(m.expiresAt).getTime() - Date.now()) / 86_400_000) }}
      skillIcons={icons}
    />
  );
}
