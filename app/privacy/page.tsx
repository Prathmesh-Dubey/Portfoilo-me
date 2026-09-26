import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { adminEmail } from '@/lib/auth';
import { SUPPORT } from '@/lib/members';

export const metadata: Metadata = {
  title: 'Privacy policy · ReuseMe',
  description: 'What ReuseMe collects, why, and how to have it deleted.',
};

const UPDATED = '27 September 2026';

// Plain-language privacy policy (also the link Google's OAuth consent screen requires).
export default async function PrivacyPage() {
  const contact = SUPPORT.email || (await adminEmail().catch(() => ''));
  return (
    <div className="site legal-page">
      <div className="bg-glow" aria-hidden="true" />
      <main className="wrap legal">
        <Link href="/" className="legal-brand">
          <BrandLogo size={40} />
          <span className="rm-word">
            <b>Reuse</b>Me
          </span>
        </Link>
        <h1>Privacy policy</h1>
        <p className="muted">Last updated {UPDATED}</p>

        <section>
          <h2>Who we are</h2>
          <p>
            ReuseMe (reuseme-zeta.vercel.app and the ReuseMe Android app) offers a free resume builder and paid portfolio websites. It is run by
            Prathmesh Dubey{contact && <> ({contact})</>}.
          </p>
        </section>

        <section>
          <h2>What we collect</h2>
          <ul>
            <li>
              <b>Account details:</b> your name and email address, and a password if you choose one (stored only as a secure hash, never as
              text).
            </li>
            <li>
              <b>Sign in with Google:</b> your name, email address and Google profile photo, which Google shares when you choose to continue with
              Google. We don&apos;t get your Google password or access to anything else in your Google account.
            </li>
            <li>
              <b>What you create:</b> resume drafts you save to your account, and for members the portfolio content, photo, screenshots and
              resume files you upload.
            </li>
            <li>
              <b>Memberships:</b> the name, email, chosen web address and UPI transaction ID you give us when paying. Payments go directly to our
              UPI ID through your UPI app; we never see or store bank or card details.
            </li>
            <li>
              <b>Messages:</b> suggestions you send through the site, with the name and email you enter.
            </li>
          </ul>
          <p>Without an account, the resume builder keeps your draft only in your own browser. Nothing is sent to us except to create the PDF.</p>
        </section>

        <section>
          <h2>How we use it</h2>
          <ul>
            <li>To sign you in and keep you signed in (one session cookie; we don&apos;t use advertising or tracking cookies).</li>
            <li>To save your resume and show your portfolio website.</li>
            <li>To email you sign-in codes, membership confirmations and replies you asked for.</li>
            <li>To check membership payments and prevent abuse (for example, limiting repeated sign-in attempts).</li>
          </ul>
          <p>We don&apos;t sell your data, share it with advertisers, or use it for anything else.</p>
        </section>

        <section>
          <h2>Where it is stored</h2>
          <p>
            Data is stored in a MongoDB Atlas database and the site is hosted on Vercel. Emails are sent through Gmail. These providers process
            data only to run the service for us.
          </p>
        </section>

        <section>
          <h2>What&apos;s public</h2>
          <p>
            A member&apos;s portfolio website, and anything they put on it, is public while their membership is active. Free accounts and saved
            resume drafts are private.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            You can edit your content at any time, sign out on any device, and ask us to delete your account and everything linked to it.
            {contact ? (
              <>
                {' '}
                Email <a href={`mailto:${contact}`}>{contact}</a>
              </>
            ) : (
              ' Contact us'
            )}
            {SUPPORT.whatsapp && (
              <>
                {' '}
                or message us on <a href={`https://wa.me/${SUPPORT.whatsapp}`}>WhatsApp</a>
              </>
            )}{' '}
            and we&apos;ll delete it within 7 days.
          </p>
        </section>

        <section>
          <h2>Children</h2>
          <p>ReuseMe is not meant for children under 13, and we don&apos;t knowingly collect their data.</p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>If this policy changes, we&apos;ll update it here and change the date at the top.</p>
        </section>

        <p className="legal-back">
          <Link href="/">← Back to ReuseMe</Link>
        </p>
      </main>
    </div>
  );
}
