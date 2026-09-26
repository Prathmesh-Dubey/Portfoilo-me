import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import Portfolio from '@/components/Portfolio';
import { findMemberBySlug, isLive } from '@/lib/members';
import { skillIcons } from '@/lib/skillIcons';
import { publicView, readPortfolio, SLUG_RE, tenantExists } from '@/lib/store';

// A member's public portfolio: /<their-name>. Visible while their membership is active.
type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  if (!SLUG_RE.test(slug) || !tenantExists(slug)) return null;
  const member = findMemberBySlug(slug);
  return { live: isLive(member), data: readPortfolio(slug) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load((await params).slug);
  if (!found?.live) return { title: 'Portfolio unavailable · ReuseMe', robots: { index: false } };
  const { profile, summary } = found.data;
  return { title: `${profile.name} — ${profile.title.replace(/\s*\|\s*/g, ' · ')}`, description: profile.tagline || summary };
}

export default async function MemberPortfolio({ params }: Props) {
  await connection();
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  if (!found.live) {
    return (
      <div className="site unavailable">
        <div className="bg-glow" aria-hidden="true" />
        <div className="card unavailable-card">
          <h1>This portfolio is resting</h1>
          <p className="muted">The owner&apos;s ReuseMe membership isn&apos;t active right now. Check back soon.</p>
          <Link href="/" className="btn btn-primary">
            Discover ReuseMe
          </Link>
        </div>
      </div>
    );
  }
  const data = publicView(found.data);
  return <Portfolio initial={data} admin={false} tenant={slug} skillIcons={skillIcons(data.skills.flatMap((g) => g.items))} />;
}
