'use client';

import { useContext, useState } from 'react';
import type { Certification } from '@/lib/types';
import { Icon } from './Icons';
import { TenantContext, withTenant } from './TenantContext';

/** Certificate cards for the portfolio: a live preview of the certificate page, its details, and a "View certificate" link. */
export function CertificateGrid({ items }: { items: Certification[] }) {
  return (
    <div className="certs-grid">
      {items.map((c) => (
        <CertificateCard key={c.id} cert={c} />
      ))}
    </div>
  );
}

function CertificateCard({ cert: c }: { cert: Certification }) {
  const tenant = useContext(TenantContext);
  const [failed, setFailed] = useState(false);
  const title = c.name || c.course;
  const details = [c.issuer, c.date].filter(Boolean).join(' · ');
  const preview = c.url && !failed ? withTenant(`/api/preview?url=${encodeURIComponent(c.url)}`, tenant) : '';

  const media = preview ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="cover" src={preview} alt={`${title} certificate`} loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <div className="cert-art" aria-hidden="true">
      <Icon name="award" size={40} />
      <span>{c.course || c.issuer || 'Certificate'}</span>
    </div>
  );

  return (
    <article className="card cert-card reveal">
      {c.url ? (
        <a className="pc-media cert-media" href={c.url} target="_blank" rel="noopener noreferrer" aria-label={`View ${title} certificate`}>
          {media}
        </a>
      ) : (
        <div className="pc-media cert-media">{media}</div>
      )}
      <div className="cert-body">
        <h3>{title}</h3>
        {c.name && c.course && <span className="chip sm">{c.course}</span>}
        {details && <p className="muted small">{details}</p>}
        {c.url && (
          <a className="btn btn-ghost btn-sm cert-view" href={c.url} target="_blank" rel="noopener noreferrer">
            View certificate <Icon name="external" size={14} />
          </a>
        )}
      </div>
    </article>
  );
}
