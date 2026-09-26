import type { Metadata } from 'next';
import { connection } from 'next/server';
import MobileLanding from '@/components/MobileLanding';
import Portfolio from '@/components/Portfolio';
import { PRICES } from '@/lib/members';
import { skillIcons } from '@/lib/skillIcons';
import { publicView, readPortfolio } from '@/lib/store';

export async function generateMetadata(): Promise<Metadata> {
  const { profile, summary } = readPortfolio();
  return {
    title: `${profile.name} — ${profile.title.replace(/\s*\|\s*/g, ' · ')}`,
    description: profile.tagline || summary,
  };
}

export default async function Home() {
  await connection(); // always read the latest saved content
  const data = publicView(readPortfolio());
  return (
    <>
      {/* Phones see the ReuseMe landing first; desktop goes straight to the portfolio (CSS decides). */}
      <MobileLanding prices={PRICES} ownerName={data.profile.name} />
      <Portfolio initial={data} admin={false} skillIcons={skillIcons(data.skills.flatMap((g) => g.items))} />
    </>
  );
}
