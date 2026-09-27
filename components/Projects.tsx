'use client';

import { useContext, useEffect, useState } from 'react';
import { projectLinks } from '@/lib/links';
import type { Project } from '@/lib/types';
import { useBackClose } from './backClose';
import { Icon, linkIcon } from './Icons';
import { TenantContext, withTenant } from './TenantContext';

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const initials = (s: string) =>
  s.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export const dateRange = (a: string, b: string) => [a, b].filter(Boolean).join(' — ');

/**
 * Images for a project, in priority order:
 * your screenshots → a live capture of the deployed site's front page → the GitHub repo's preview card.
 */
export function projectImages(p: Project, tenant = ''): string[] {
  if (p.images.length) return p.images;
  if (!p.autoPreview) return [];
  const source = p.demo || p.repo || p.links[0]?.url;
  return source ? [withTenant(`/api/preview?url=${encodeURIComponent(source)}`, tenant)] : [];
}

/** Where clicking the preview goes: the live site if deployed, otherwise the GitHub repo. */
export function primaryLink(p: Project): { url: string; label: string } | null {
  if (p.demo) return { url: p.demo, label: 'Visit live site' };
  if (p.repo) return { url: p.repo, label: 'View code on GitHub' };
  if (p.links[0]) return { url: p.links[0].url, label: `Open ${p.links[0].label || 'link'}` };
  return null;
}

/** Preview image with a generated artwork fallback, so a project never shows a broken or empty box. */
export function ProjectCover({ project, src, className = '' }: { project: Project; src?: string; className?: string }) {
  const tenant = useContext(TenantContext);
  const image = src ?? projectImages(project, tenant)[0];
  const [failed, setFailed] = useState(false);
  const hue = hash(project.name) % 360;

  if (image && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`cover ${className}`} src={image} alt={`${project.name} preview`} loading="lazy" onError={() => setFailed(true)} />;
  }
  return (
    <div className={`cover cover-art ${className}`} style={{ '--h': hue } as React.CSSProperties} aria-hidden="true">
      <span className="cover-initials">{initials(project.name) || '•'}</span>
      <span className="cover-code">{project.tech.slice(0, 4).join('  /  ')}</span>
    </div>
  );
}

export function ProjectLinks({ project, compact = false }: { project: Project; compact?: boolean }) {
  const links = projectLinks(project);
  if (!links.length) return null;
  return (
    <div className={`plinks ${compact ? 'compact' : ''}`}>
      {links.map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="plink">
          <Icon name={l.url === project.demo ? 'globe' : linkIcon(l.label, l.url)} size={15} />
          <span>{l.label || new URL(l.url).hostname.replace(/^www\./, '')}</span>
        </a>
      ))}
    </div>
  );
}

export function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const images = projectImages(project, useContext(TenantContext));
  const [active, setActive] = useState(0);

  useBackClose(true, onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setActive((a) => Math.min(a + 1, Math.max(images.length - 1, 0)));
      if (e.key === 'ArrowLeft') setActive((a) => Math.max(a - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose, images.length]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal project-modal" role="dialog" aria-modal="true" aria-label={project.name}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>
        <div className="pm-media">
          <ProjectCover key={images[active] ?? 'art'} project={project} src={images[active]} className="pm-main" />
          {images.length > 1 && (
            <div className="pm-thumbs">
              {images.map((src, i) => (
                <button key={src + i} className={i === active ? 'on' : ''} onClick={() => setActive(i)} aria-label={`Image ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="pm-body">
          <div className="pm-head">
            <div>
              <h3>{project.name}</h3>
              {project.subtitle && <p className="pm-sub">{project.subtitle}</p>}
            </div>
            {(project.start || project.end) && <span className="date-pill">{dateRange(project.start, project.end)}</span>}
          </div>
          {project.summary && <p className="pm-summary">{project.summary}</p>}
          {project.bullets.length > 0 && (
            <ul className="ticks">
              {project.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {project.tech.length > 0 && (
            <div className="chips">
              {project.tech.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          )}
          <ProjectLinks project={project} />
        </div>
      </div>
    </div>
  );
}
