import type { Metadata } from 'next';
import { connection } from 'next/server';
import MobileLanding from '@/components/MobileLanding';
import { accountSummary } from '@/lib/auth';
import { PRICES } from '@/lib/members';
import { readPortfolio } from '@/lib/store';

export const metadata: Metadata = {
  title: 'ReuseMe · Free resume builder & portfolio websites',
  description: 'Build a one-page resume for free, or get your own portfolio website with a personal link.',
};

// The phone home page (ReuseMe landing with pricing), opened from the desktop navbar's "Live" button.
export default async function LivePage() {
  await connection();
  const { profile } = await readPortfolio();
  return <MobileLanding prices={PRICES} ownerName={profile.name} account={await accountSummary()} standalone />;
}
