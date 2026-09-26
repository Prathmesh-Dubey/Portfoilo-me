import type { Metadata } from 'next';
import { headers } from 'next/headers';
import JoinFlow from '@/components/JoinFlow';
import { adminEmail, currentUser } from '@/lib/auth';
import { PRICES, SUPPORT, UPI } from '@/lib/members';

export const metadata: Metadata = {
  title: 'Get your portfolio · ReuseMe',
  description: 'Your own portfolio website with a personal link. Pay monthly or yearly by UPI.',
};

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const plan = (await searchParams).plan === 'monthly' ? 'monthly' : 'yearly';
  const host = (await headers()).get('host') || 'reuseme';
  const support = { whatsapp: SUPPORT.whatsapp, email: SUPPORT.email || adminEmail() };
  // Signed-in free users and members pay with their own login email, filled in for them.
  const me = await currentUser();
  const account = me?.role === 'user' ? { name: me.user.name, email: me.email } : me?.role === 'member' ? { name: me.member.name, email: me.email } : null;
  return <JoinFlow prices={PRICES} upi={UPI} initialPlan={plan} host={host} support={support} account={account} />;
}
