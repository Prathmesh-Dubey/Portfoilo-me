'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { gmailCompose } from '@/lib/links';
import { MAX_RESUME_PROJECTS, type Portfolio as Data, type Project, type SkillGroup } from '@/lib/types';
import { useBackClose } from './backClose';
import { BrandLogo } from './BrandLogo';
import { saveFile } from './nativeApp';
import { CertificateGrid } from './Certificates';
import { Icon, linkIcon } from './Icons';
import { ProjectCover, ProjectLinks, ProjectModal, dateRange, primaryLink } from './Projects';
import { EditorModal, type EditorSpec } from './admin/Form';
import {
  accountEditor,
  aboutEditor,
  educationEditor,
  experienceEditor,
  extrasEditor,
  profileEditor,
  projectEditor,
  siteEditor,
  skillsEditor,
  type AdminCtx,
} from './admin/editors';
import { Inbox } from './admin/Inbox';
import { MembersPanel } from './admin/MembersPanel';
import { ResumeStudio } from './admin/ResumeStudio';
import { exitPreview } from './previewMode';
import { SkillsGrid, projectsUsing, type SkillIconMap } from './Skills';
import { SuggestionForm } from './SuggestionForm';
import { TenantContext, withTenant } from './TenantContext';

type Toast = { id: number; msg: string; kind: 'ok' | 'error'; action?: { label: string; run: () => void } };

export type MemberInfo = { slug: string; plan: 'monthly' | 'yearly'; expiresAt: string; live: boolean; daysLeft: number };

export default function Portfolio({
  initial,
  admin,
  adminEmail = '',
  skillIcons = {},
  tenant = '',
  role = 'owner',
  member,
}: {
  initial: Data;
  admin: boolean;
  adminEmail?: string;
  skillIcons?: SkillIconMap;
  /** '' = the owner's site; otherwise the member slug whose portfolio this is */
  tenant?: string;
  /** who is signed in (only matters when admin) */
  role?: 'owner' | 'member';
  member?: MemberInfo;
}) {
  const isOwnerSite = !tenant;
  const u = (url: string) => withTenant(url, tenant);
  const [membersOpen, setMembersOpen] = useState(false);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [skillFilter, setSkillFilter] = useState<SkillGroup | null>(null);
  const [data, setDataState] = useState(initial);
  const dataRef = useRef(initial);
  const setData = useCallback((d: Data) => {
    dataRef.current = d;
    setDataState(d);
  }, []);

  const [editMode, setEditMode] = useState(admin);
  const editing = admin && editMode;
  const [editor, setEditor] = useState<EditorSpec | null>(null);
  const [studio, setStudio] = useState(false);
  const [openProject, setOpenProject] = useState<Project | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [inbox, setInbox] = useState(false);
  const [unread, setUnread] = useState(0);

  const notify = useCallback((msg: string, kind: 'ok' | 'error' = 'ok', action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : action ? 6000 : 2800);
  }, []);

  // After every save, offer a one-click jump to the visitor's view.
  const showUserView = useCallback(() => {
    setEditMode(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!admin || role !== 'owner') return;
    fetch('/api/suggestions')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: unknown[]) => setUnread(list.length))
      .catch(() => {});
    fetch('/api/members')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPendingPayments(d.payments.filter((x: { status: string }) => x.status === 'submitted').length))
      .catch(() => {});
  }, [admin, role, inbox, membersOpen]);

  const save = useCallback(
    async (next: Data, message = 'Saved') => {
      const res = await fetch('/api/portfolio', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body.current) {
        setData(body.current);
        notify('This page was out of date (the site was changed in another tab). The latest version is loaded now, so please make that change again.', 'error');
        throw new Error('conflict');
      }
      if (!res.ok) {
        notify(res.status === 401 ? 'Session expired — please log in again.' : body.error || 'Save failed', 'error');
        throw new Error(body.error || 'Save failed');
      }
      setData(body);
      notify(message, 'ok', { label: 'See user view', run: showUserView });
      return body as Data;
    },
    [notify, setData, showUserView],
  );

  const ctx: AdminCtx = useMemo(() => ({ latest: () => dataRef.current, save, setData, notify }), [save, setData, notify]);
  const open = (build: (c: AdminCtx) => EditorSpec) => setEditor(build(ctx));

  useReveal();
  // Admin viewing "user view" on a phone: back gesture / hardware back returns to editing,
  // same as tapping "Back to editing" in the banner — there's no Escape key on a phone.
  useBackClose(admin && !editMode, () => setEditMode(true));

  const p = data.profile;
  const firstName = p.name.split(' ')[0] || p.name;
  const roles = p.title.split('|').map((s) => s.trim()).filter(Boolean);
  const current = data.experience[0];
  const techCount = new Set(data.skills.flatMap((g) => g.items.map((i) => i.toLowerCase()))).size;
  const hasCerts = data.certifications.length > 0;
  const hasAchievements = data.achievements.length > 0;

  const nav = [
    { id: 'about', label: 'About' },
    { id: 'skills', label: 'Skills', show: data.skills.length > 0 },
    { id: 'experience', label: 'Experience', show: data.experience.length > 0 },
    { id: 'projects', label: 'Projects' },
    { id: 'certifications', label: 'Certificates', show: hasCerts },
    { id: 'education', label: 'Education', show: data.education.length > 0 || hasAchievements },
    { id: 'contact', label: 'Contact' },
    { id: 'suggest', label: 'Suggest', show: isOwnerSite },
  ].filter((n) => n.show !== false || (editing && n.id !== 'suggest'));

  let sectionNo = 0;
  const num = () => String(++sectionNo).padStart(2, '0');

  return (
    <TenantContext.Provider value={tenant}>
    <div
      className={`site ${editing ? 'is-editing' : ''} ${admin ? 'has-dock' : ''} ${isOwnerSite && !admin ? 'owner-site' : ''} ${admin && !editMode ? 'showing-userview-banner' : ''}`}
      style={{ '--accent': data.settings.site.accent } as React.CSSProperties}
    >
      {isOwnerSite && !admin && (
        <div className="preview-bar">
          <span>Previewing a ReuseMe portfolio</span>
          <button onClick={exitPreview}>
            <Icon name="up" size={14} /> Back to ReuseMe
          </button>
        </div>
      )}
      {admin && role === 'member' && member && <MemberBanner member={member} />}
      <div className="bg-glow" aria-hidden="true" />
      <Nav name={p.name} items={nav} resumeHref={u('/api/resume/download')} showLive={isOwnerSite} />

      {/* ---------------- hero ---------------- */}
      <header className="hero wrap" id="top">
        <div className="hero-text">
          <div className="hero-top">
            {p.available && (
              <span className="status-pill">
                <span className="pulse" /> Open to opportunities
              </span>
            )}
            {editing && <EditButton onClick={() => open(profileEditor)} label="Edit profile" />}
          </div>
          <p className="hello">Hi, I&apos;m {firstName} —</p>
          <h1 className="hero-name">{p.name}</h1>
          {roles.length > 0 && (
            <p className="hero-roles">
              {roles.map((r, i) => (
                <span key={i}>{r}</span>
              ))}
            </p>
          )}
          {(p.tagline || data.summary) && <p className="hero-tagline">{p.tagline || data.summary}</p>}
          <div className="hero-cta">
            <a href="#projects" className="btn btn-primary btn-lg">
              View my work <Icon name="down" size={17} />
            </a>
            <a href={u('/api/resume/download')} className="btn btn-ghost btn-lg">
              <Icon name="download" size={17} /> Download resume
            </a>
          </div>
          <div className="socials">
            {p.links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.label} title={l.label} className="icon-btn">
                <Icon name={linkIcon(l.label, l.url)} />
              </a>
            ))}
            {p.email && (
              <a href={gmailCompose(p.email)} target="_blank" rel="noopener noreferrer" aria-label="Email me on Gmail" title="Email me" className="icon-btn">
                <Icon name="mail" />
              </a>
            )}
          </div>
        </div>

        <div className="hero-card reveal">
          <div className="avatar-ring">
            {p.photo ? (
              <button className="avatar-btn" onClick={() => setPhotoOpen(true)} aria-label={`View ${p.name}'s photo`} title="Click to view full photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u(`/api/photo?v=${p.photo}`)} alt={p.name} className="avatar" />
              </button>
            ) : (
              <div className="avatar avatar-mono">{p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}</div>
            )}
          </div>
          {current && (
            <div className="now">
              <span className="eyebrow">Currently</span>
              <b>{current.role}</b>
              <span>@ {current.company}</span>
            </div>
          )}
          <dl className="stats">
            <div>
              <dt>{data.projects.length}</dt>
              <dd>Projects</dd>
            </div>
            <div>
              <dt>{techCount}+</dt>
              <dd>Technologies</dd>
            </div>
            <div>
              <dt>{data.experience.length}</dt>
              <dd>{data.experience.length === 1 ? 'Role' : 'Roles'}</dd>
            </div>
          </dl>
          {p.location && (
            <p className="hero-loc">
              <Icon name="pin" size={15} /> {p.location}
            </p>
          )}
        </div>
      </header>

      <main>
        {/* ---------------- about ---------------- */}
        <section id="about" className="section wrap">
          <SectionHead no={num()} tag="about" title="About me" onEdit={editing ? () => open(aboutEditor) : undefined} />
          <div className="about-grid reveal">
            <div className="about-text">
              <p className="lead">{data.summary}</p>
              {data.about && data.about.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
            </div>
            <ul className="facts">
              {p.location && (
                <li>
                  <Icon name="pin" />
                  <span>
                    <small>Current location</small>
                    {p.location}
                  </span>
                </li>
              )}
              {p.email && (
                <li>
                  <Icon name="mail" />
                  <span>
                    <small>Email</small>
                    <a href={gmailCompose(p.email)} target="_blank" rel="noopener noreferrer">
                      {p.email}
                    </a>
                  </span>
                </li>
              )}
              {current && (
                <li>
                  <Icon name="briefcase" />
                  <span>
                    <small>Working at</small>
                    {current.company}
                  </span>
                </li>
              )}
              {data.education[0] && (
                <li>
                  <Icon name="cap" />
                  <span>
                    <small>Studied</small>
                    {data.education[0].degree}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </section>

        {/* ---------------- skills ---------------- */}
        {(data.skills.length > 0 || editing) && (
          <section id="skills" className="section wrap">
            <SectionHead no={num()} tag="skills" title="Skills & tools" onEdit={editing ? () => open(skillsEditor) : undefined} />
            <SkillsGrid
              groups={data.skills}
              projects={data.projects}
              initialIcons={skillIcons}
              onViewProjects={(g) => {
                setSkillFilter(g);
                document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          </section>
        )}

        {/* ---------------- experience ---------------- */}
        {(data.experience.length > 0 || editing) && (
          <section id="experience" className="section wrap">
            <SectionHead no={num()} tag="experience" title="Experience" onEdit={editing ? () => open(experienceEditor) : undefined} />
            <ol className="timeline">
              {data.experience.map((x) => (
                <li key={x.id} className="reveal">
                  <div className="tl-dot" aria-hidden="true" />
                  <div className="card tl-card">
                    <div className="tl-head">
                      <div>
                        <h3>{x.role}</h3>
                        <p className="tl-company">
                          {x.company}
                          {x.location && <span> · {x.location}</span>}
                        </p>
                      </div>
                      <span className="date-pill">{dateRange(x.start, x.end)}</span>
                    </div>
                    <ul className="ticks">
                      {x.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                    {x.tech.length > 0 && (
                      <div className="chips">
                        {x.tech.map((t) => (
                          <span key={t} className="chip sm">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ---------------- projects ---------------- */}
        <ProjectsSection
          data={data}
          editing={editing}
          ctx={ctx}
          num={num()}
          onOpen={setOpenProject}
          onEdit={(id) => open((c) => projectEditor(c, id))}
          skillFilter={skillFilter}
          clearSkillFilter={() => setSkillFilter(null)}
        />

        {/* ---------------- certifications ---------------- */}
        {(hasCerts || editing) && (
          <section id="certifications" className="section wrap">
            <SectionHead no={num()} tag="certifications" title="Certificates" count={data.certifications.length} onEdit={editing ? () => open(extrasEditor) : undefined} />
            {!hasCerts && <p className="muted">No certificates yet. Hidden from visitors until you add one.</p>}
            <CertificateGrid items={data.certifications} />
          </section>
        )}

        {/* ---------------- education + achievements ---------------- */}
        {(data.education.length > 0 || hasAchievements || editing) && (
          <section id="education" className="section wrap">
            <SectionHead no={num()} tag="education" title="Education" onEdit={editing ? () => open(educationEditor) : undefined} />
            <div className="edu-grid">
              {data.education.map((e) => (
                <article key={e.id} className="card edu-card reveal">
                  <div className="edu-icon">
                    <Icon name="cap" size={22} />
                  </div>
                  <div>
                    <span className="date-pill">{dateRange(e.start, e.end)}</span>
                    <h3>{e.degree}</h3>
                    <p className="muted">{e.school}</p>
                    {e.score && <p className="score">{e.score}</p>}
                  </div>
                </article>
              ))}
            </div>

            {(hasAchievements || editing) && (
              <div className="extras">
                <div className="extras-head">
                  <h3 className="sub-title">Achievements</h3>
                  {editing && <EditButton onClick={() => open(extrasEditor)} label="Edit" />}
                </div>
                {!hasAchievements && editing && <p className="muted">Nothing here yet — hidden from visitors until you add something.</p>}
                <div className="extras-grid">
                  {data.achievements.map((a, i) => (
                    <article key={i} className="card cert reveal">
                      <Icon name="star" size={20} />
                      <div>
                        <span>{a}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ---------------- contact ---------------- */}
        <section id="contact" className="section wrap">
          <div className="contact-card reveal">
            <span className="eyebrow">{num()} · Contact</span>
            <h2>
              Let&apos;s build something <span className="grad">great together.</span>
            </h2>
            <p className="muted">I&apos;m open to full-time roles, internships and interesting freelance work. The fastest way to reach me is email.</p>
            <div className="contact-actions">
              {p.email && (
                <a className="btn btn-primary btn-lg" href={gmailCompose(p.email)} target="_blank" rel="noopener noreferrer">
                  <Icon name="mail" size={18} /> {p.email}
                </a>
              )}
              {p.email && (
                <button
                  className="btn btn-ghost btn-lg"
                  onClick={() => navigator.clipboard?.writeText(p.email).then(() => notify('Email copied'), () => notify('Could not copy', 'error'))}
                >
                  <Icon name="copy" size={18} /> Copy
                </button>
              )}
              {p.phone && (
                <a className="btn btn-ghost btn-lg" href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}>
                  <Icon name="phone" size={18} /> {p.phone}
                </a>
              )}
            </div>
            <div className="socials center">
              {p.links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="social-link">
                  <Icon name={linkIcon(l.label, l.url)} size={17} /> {l.label || l.url}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- suggestions (owner's site only) ---------------- */}
        {isOwnerSite && (
          <section id="suggest" className="section wrap">
            <SuggestionForm no={num()} />
          </section>
        )}
      </main>

      <footer className="footer wrap">
        <span className="footer-brand">
          <BrandLogo size={30} />
          © {new Date().getFullYear()} {p.name}
        </span>
        {!isOwnerSite && (
          <Link href="/" className="made-with">
            Made with <b>Reuse</b>
            <span>Me</span>
          </Link>
        )}
        <a href="#top">Back to top ↑</a>
      </footer>

      <Link href="/resume-builder" className="builder-fab" aria-label="Build your resume">
        <span className="fab-spark">
          <Icon name="sparkle" size={18} />
        </span>
        <span>Build resume</span>
      </Link>

      {/* ---------------- overlays ---------------- */}
      {openProject && <ProjectModal project={openProject} onClose={() => setOpenProject(null)} />}
      {photoOpen && p.photo && <PhotoLightbox src={u(`/api/photo?v=${p.photo}`)} name={p.name} onClose={() => setPhotoOpen(false)} />}
      {editor && <EditorModal spec={editor} onClose={() => setEditor(null)} />}
      {studio && <ResumeStudio data={data} ctx={ctx} onClose={() => setStudio(false)} />}
      {inbox && <Inbox onClose={() => setInbox(false)} />}
      {membersOpen && <MembersPanel onClose={() => setMembersOpen(false)} />}
      {admin && !editMode && (
        <div className="userview-banner" role="status">
          <Icon name="eye" size={16} /> You&apos;re seeing the user view — exactly what visitors see.
          <button className="btn btn-sm btn-primary" onClick={() => setEditMode(true)}>
            <Icon name="edit" size={14} /> Back to editing
          </button>
        </div>
      )}
      {admin && (
        <AdminDock
          editMode={editMode}
          setEditMode={setEditMode}
          onStudio={() => setStudio(true)}
          onStyle={() => open(siteEditor)}
          onAccount={() => open((c) => accountEditor(c, adminEmail))}
          onInbox={() => setInbox(true)}
          unread={unread}
          onMembers={() => setMembersOpen(true)}
          pendingPayments={pendingPayments}
          role={role}
          siteHref={tenant ? `/${tenant}` : '/'}
          ctx={ctx}
        />
      )}

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon name={t.kind === 'ok' ? 'check' : 'x'} size={16} /> {t.msg}
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action!.run();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
    </TenantContext.Provider>
  );
}

function MemberBanner({ member }: { member: MemberInfo }) {
  const until = new Date(member.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const days = member.daysLeft;
  return (
    <div className={`member-banner ${member.live ? '' : 'expired'}`}>
      <div className="wrap member-banner-inner">
        {member.live ? (
          <span>
            <b>{member.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan</b> · active until {until}
            {days <= 7 && ` (${days} day${days === 1 ? '' : 's'} left)`}
          </span>
        ) : (
          <span>
            <b>Your membership has ended</b>, so your website is hidden from visitors. Renew to publish it again.
          </span>
        )}
        <span className="row-gap">
          <a className="btn btn-sm" href={`/${member.slug}`} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={14} /> /{member.slug}
          </a>
          {(!member.live || days <= 7) && (
            <Link className="btn btn-sm btn-primary" href="/join">
              Renew
            </Link>
          )}
        </span>
      </div>
    </div>
  );
}

// ======================================================================

function ProjectsSection({
  data,
  editing,
  ctx,
  num,
  onOpen,
  onEdit,
  skillFilter,
  clearSkillFilter,
}: {
  data: Data;
  editing: boolean;
  ctx: AdminCtx;
  num: string;
  onOpen: (p: Project) => void;
  onEdit: (id: string | null) => void;
  skillFilter: SkillGroup | null;
  clearSkillFilter: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const resumeIds = data.settings.resume.projectIds;

  // Most-used technologies become filter chips.
  const tags = useMemo(() => {
    const count = new Map<string, number>();
    data.projects.forEach((p) => p.tech.forEach((t) => count.set(t, (count.get(t) || 0) + 1)));
    return ['All', ...[...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t)];
  }, [data.projects]);

  const q = query.trim().toLowerCase();
  const bySkill = skillFilter ? new Set(projectsUsing(skillFilter.items, data.projects)) : null;
  const shown = data.projects.filter(
    (p) =>
      (!bySkill || bySkill.has(p)) &&
      (filter === 'All' || p.tech.includes(filter)) &&
      (!q || [p.name, p.subtitle, p.summary, ...p.tech].join(' ').toLowerCase().includes(q)),
  );

  const move = (id: string, dir: -1 | 1) => {
    const d = ctx.latest();
    const i = d.projects.findIndex((p) => p.id === id);
    const j = i + dir;
    if (j < 0 || j >= d.projects.length) return;
    const projects = [...d.projects];
    [projects[i], projects[j]] = [projects[j], projects[i]];
    ctx.save({ ...d, projects }, 'Order saved').catch(() => {});
  };

  const toggleResume = (id: string) => {
    const d = ctx.latest();
    const ids = d.settings.resume.projectIds;
    if (!ids.includes(id) && ids.length >= MAX_RESUME_PROJECTS) {
      ctx.notify(`The resume holds ${MAX_RESUME_PROJECTS} projects — remove one first.`, 'error');
      return;
    }
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    ctx.save({ ...d, settings: { ...d.settings, resume: { ...d.settings.resume, projectIds: next } } }, ids.includes(id) ? 'Removed from resume' : 'Added to resume').catch(() => {});
  };

  return (
    <section id="projects" className="section wrap">
      <SectionHead no={num} tag="projects" title="Selected projects" count={data.projects.length}>
        {editing && (
          <button className="btn btn-primary" onClick={() => onEdit(null)}>
            <Icon name="plus" size={16} /> Add project
          </button>
        )}
      </SectionHead>

      {skillFilter && (
        <div className="skill-filter-bar">
          <span>
            Showing projects that use <b>{skillFilter.category}</b> skills ({shown.length})
          </span>
          <button className="btn btn-sm" onClick={clearSkillFilter}>
            <Icon name="x" size={14} /> Show all projects
          </button>
        </div>
      )}
      {data.projects.length > 2 && (
        <div className="filters">
          <div className="tags" role="tablist" aria-label="Filter by technology">
            {tags.map((t) => (
              <button key={t} role="tab" aria-selected={filter === t} className={`tag ${filter === t ? 'on' : ''}`} onClick={() => setFilter(t)}>
                {t}
              </button>
            ))}
          </div>
          <label className="search">
            <Icon name="search" size={16} />
            <input type="search" placeholder="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
      )}

      <div className="projects-grid">
        {shown.map((p) => {
          const inResume = resumeIds.includes(p.id);
          const idx = data.projects.indexOf(p);
          const primary = primaryLink(p);
          return (
            <article
              key={p.id}
              className="card project-card reveal"
              tabIndex={0}
              onClick={() => onOpen(p)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), onOpen(p))}
            >
              <div className="pc-media">
                <ProjectCover project={p} />
                {primary && (
                  <a className="pc-visit" href={primary.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    <span>
                      <Icon name={p.demo ? 'globe' : 'github'} size={16} /> {primary.label} <Icon name="external" size={14} />
                    </span>
                  </a>
                )}
                <div className="pc-badges">
                  {p.featured && (
                    <span className="badge">
                      <Icon name="star" size={12} /> Featured
                    </span>
                  )}
                  {editing && inResume && <span className="badge resume">On resume #{resumeIds.indexOf(p.id) + 1}</span>}
                </div>
              </div>
              <div className="pc-body">
                <div className="pc-title">
                  <h3>{p.name}</h3>
                  {(p.start || p.end) && <span className="pc-date">{dateRange(p.start, p.end)}</span>}
                </div>
                {p.subtitle && <p className="pc-sub">{p.subtitle}</p>}
                {p.summary && <p className="pc-summary">{p.summary}</p>}
                {p.tech.length > 0 && (
                  <div className="chips">
                    {p.tech.slice(0, 5).map((t) => (
                      <span key={t} className="chip sm">
                        {t}
                      </span>
                    ))}
                    {p.tech.length > 5 && <span className="chip sm ghost">+{p.tech.length - 5}</span>}
                  </div>
                )}
                <div className="pc-foot">
                  <ProjectLinks project={p} compact />
                  <span className="pc-more">
                    Details <Icon name="external" size={14} />
                  </span>
                </div>
              </div>

              {editing && (
                <div className="pc-admin" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <button className="btn btn-sm" onClick={() => onEdit(p.id)}>
                    <Icon name="edit" size={14} /> Edit
                  </button>
                  <button className={`btn btn-sm ${inResume ? 'on' : ''}`} onClick={() => toggleResume(p.id)} title="Include in resume PDF">
                    <Icon name="file" size={14} /> {inResume ? 'On resume' : 'Add to resume'}
                  </button>
                  <button className="icon-btn sm" disabled={idx === 0} onClick={() => move(p.id, -1)} aria-label="Move earlier">
                    <Icon name="up" size={14} />
                  </button>
                  <button className="icon-btn sm" disabled={idx === data.projects.length - 1} onClick={() => move(p.id, 1)} aria-label="Move later">
                    <Icon name="down" size={14} />
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {editing && (
          <button className="card add-card" onClick={() => onEdit(null)}>
            <Icon name="plus" size={28} />
            <b>Add a project</b>
            <span>Unlimited projects, links and previews</span>
          </button>
        )}
      </div>
      {shown.length === 0 && data.projects.length > 0 && <p className="muted center">No projects match that filter.</p>}
    </section>
  );
}

// ======================================================================

function SectionHead({ no, tag, title, count, onEdit, children }: { no: string; tag: string; title: string; count?: number; onEdit?: () => void; children?: React.ReactNode }) {
  return (
    <div className="section-head reveal">
      <div>
        <span className="eyebrow">
          {no} · {tag}
        </span>
        <h2>
          {title}
          {count !== undefined && <sup>{count}</sup>}
        </h2>
      </div>
      <div className="row-gap">
        {onEdit && <EditButton onClick={onEdit} />}
        {children}
      </div>
    </div>
  );
}

function EditButton({ onClick, label = 'Edit' }: { onClick: () => void; label?: string }) {
  return (
    <button className="btn btn-edit" onClick={onClick}>
      <Icon name="edit" size={14} /> {label}
    </button>
  );
}

/** `showLive`: the owner's site links to the ReuseMe landing page with pricing (/live). Desktop only: phones already open on it. */
function Nav({ name, items, resumeHref, showLive = false }: { name: string; items: { id: string; label: string }[]; resumeHref: string; showLive?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 2).join('') || 'PD';
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The theme lives on <html data-theme>; CSS shows the matching sun/moon icon, so no React state is needed.
  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('pf-theme', next);
    } catch {
      /* private mode */
    }
  };

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="wrap nav-inner">
        <a href="#top" className="logo" aria-label="Home">
          <span className="logo-mark" aria-hidden="true">
            {initials}
          </span>
          <span className="logo-name">{name}</span>
        </a>
        <div className={`nav-links ${menu ? 'open' : ''}`}>
          {items.map((n) => (
            <a key={n.id} href={`#${n.id}`} onClick={() => setMenu(false)}>
              {n.label}
            </a>
          ))}
          {showLive && (
            <Link href="/live" className="btn btn-sm nav-live">
              <span className="live-dot" aria-hidden="true" /> Live
            </Link>
          )}
          <Link href="/resume-builder" className="btn btn-ghost btn-sm nav-cta">
            <Icon name="sparkle" size={15} /> Build your resume
          </Link>
          <a href={resumeHref} className="btn btn-primary btn-sm">
            <Icon name="download" size={15} /> My resume
          </a>
          <Link href="/admin" className="nav-admin" onClick={() => setMenu(false)}>
            <Icon name="lock" size={16} /> Admin
          </Link>
        </div>
        <div className="nav-tools">
          <button className="icon-btn theme-btn" onClick={toggleTheme} aria-label="Toggle light/dark theme">
            <Icon name="sun" className="when-dark" />
            <Icon name="moon" className="when-light" />
          </button>
          <button className="icon-btn menu-btn" onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}>
            <Icon name={menu ? 'x' : 'menu'} />
          </button>
        </div>
      </div>
    </nav>
  );
}

function AdminDock({
  editMode,
  setEditMode,
  onStudio,
  onStyle,
  onAccount,
  onInbox,
  unread,
  onMembers,
  pendingPayments,
  role,
  siteHref,
  ctx,
}: {
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  onStudio: () => void;
  onStyle: () => void;
  onAccount: () => void;
  onInbox: () => void;
  unread: number;
  onMembers: () => void;
  pendingPayments: number;
  role: 'owner' | 'member';
  siteHref: string;
  ctx: AdminCtx;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [more, setMore] = useState(false);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(ctx.latest(), null, 2)], { type: 'application/json' });
    saveFile(blob, `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const importJson = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      if (!json.profile || !Array.isArray(json.projects)) throw new Error('That file is not a portfolio backup');
      if (!confirm('Replace all current content with this backup? (The current version is kept as a backup.)')) return;
      await ctx.save({ ...json, updatedAt: ctx.latest().updatedAt }, 'Backup restored');
    } catch (e) {
      ctx.notify((e as Error).message, 'error');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
    router.refresh();
  };

  const restore = () => fileInput.current?.click();
  const close = () => setMore(false);

  return (
    <div className="dock" role="toolbar" aria-label="Admin tools">
      <span className="dock-label">
        <span className="pulse" /> Admin
      </span>
      <button className={`dock-btn ${editMode ? '' : 'on'}`} onClick={() => setEditMode(!editMode)} title={editMode ? 'See the page exactly as visitors do' : 'Back to editing'}>
        <Icon name={editMode ? 'eye' : 'edit'} size={16} />
        <span>{editMode ? 'User view' : 'Edit'}</span>
      </button>
      <button className="dock-btn accent" onClick={onStudio}>
        <Icon name="file" size={16} />
        <span>Resume PDF</span>
      </button>
      {role === 'owner' && (
        <button className="dock-btn" onClick={onMembers} title="UPI payments and member portfolios">
          <Icon name="briefcase" size={16} />
          <span>Members</span>
          {pendingPayments > 0 && <b className="count">{pendingPayments}</b>}
        </button>
      )}
      {role === 'owner' && (
        <button className="dock-btn" onClick={onInbox} title="Suggestions from visitors">
          <Icon name="inbox" size={16} />
          <span>Inbox</span>
          {unread > 0 && <b className="count">{unread}</b>}
        </button>
      )}
      <div className="dock-more">
        <button className={`dock-btn ${more ? 'on' : ''}`} onClick={() => setMore(!more)} aria-haspopup="menu" aria-expanded={more}>
          <Icon name="menu" size={16} />
          <span>More</span>
        </button>
        {more && (
          <>
            <div className="menu-backdrop" onClick={() => setMore(false)} />
            <div className="menu" role="menu">
              <MenuItem icon="external" label="Open live site in new tab" onRun={() => window.open(siteHref, '_blank', 'noopener')} done={close} />
              <MenuItem icon="settings" label="Website style" onRun={onStyle} done={close} />
              <MenuItem icon="lock" label="Account & password" onRun={onAccount} done={close} />
              <MenuItem icon="download" label="Backup (download JSON)" onRun={exportJson} done={close} />
              <MenuItem icon="upload" label="Restore from backup" onRun={restore} done={close} />
              <MenuItem icon="logout" label="Log out" onRun={logout} done={close} />
            </div>
          </>
        )}
      </div>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
    </div>
  );
}

/** Full-size view of the profile photo. Click anywhere or press Esc to close. */
function PhotoLightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  useBackClose(true, onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);

  return (
    <div className="overlay lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${name}'s photo`}>
      <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
        <Icon name="x" />
      </button>
      <figure onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} />
        <figcaption>{name}</figcaption>
      </figure>
    </div>
  );
}

function MenuItem({ icon, label, onRun, done }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onRun: () => void; done: () => void }) {
  return (
    <button
      className="menu-item"
      role="menuitem"
      onClick={() => {
        done();
        onRun();
      }}
    >
      <Icon name={icon} size={16} /> {label}
    </button>
  );
}

/** Fade sections in as they scroll into view. */
function useReveal() {
  useEffect(() => {
    const els = () => document.querySelectorAll('.reveal:not(.in)');
    let cleanup = () => {};
    // Wait a frame past the commit so this never races React's hydration check
    // (elements already in view would otherwise flip to `in` almost instantly,
    // which Next's dev overlay can misreport as a hydration mismatch).
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          els().forEach((el) => el.classList.add('in'));
          return;
        }
        const io = new IntersectionObserver(
          (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))),
          { rootMargin: '0px 0px -8% 0px' },
        );
        const observeAll = () => els().forEach((el) => io.observe(el));
        observeAll();
        // new cards (added projects, filters) should reveal too
        const mo = new MutationObserver(observeAll);
        mo.observe(document.body, { childList: true, subtree: true });
        cleanup = () => {
          io.disconnect();
          mo.disconnect();
        };
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, []);
}
