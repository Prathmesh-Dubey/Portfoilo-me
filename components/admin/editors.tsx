'use client';

import { useRef, useState } from 'react';
import { newId } from '@/lib/normalize';
import { MAX_RESUME_PROJECTS, type Portfolio, type Project } from '@/lib/types';
import { Icon } from '../Icons';
import { useTenantUrl } from '../TenantContext';
import type { EditorSpec, Field } from './Form';

export type AdminCtx = {
  /** Always the latest saved data (a ref, so editors opened earlier never overwrite newer changes). */
  latest: () => Portfolio;
  save: (next: Portfolio, message?: string) => Promise<Portfolio>;
  setData: (d: Portfolio) => void;
  notify: (msg: string, kind?: 'ok' | 'error') => void;
};

const dateHint = 'Free text, printed exactly as typed — e.g. "Mar 2026", "2022", "Present".';

export function profileEditor(ctx: AdminCtx): EditorSpec {
  const p = ctx.latest().profile;
  return {
    title: 'Profile & contact',
    description: 'Shown in the hero, contact section and resume header.',
    value: { ...p },
    fields: [
      { type: 'custom', key: 'photo', render: () => <PhotoUploader ctx={ctx} /> },
      { type: 'text', key: 'name', label: 'Full name', half: true },
      { type: 'text', key: 'location', label: 'Current location', half: true, placeholder: 'City, State, Country' },
      { type: 'text', key: 'title', label: 'Headline', hint: 'Separate roles with "|" — e.g. AI/ML Engineer | Full-Stack Software Engineer' },
      { type: 'textarea', key: 'tagline', label: 'Hero tagline (website only)', rows: 3 },
      { type: 'email', key: 'email', label: 'Email', half: true },
      { type: 'text', key: 'phone', label: 'Phone', half: true },
      { type: 'checkbox', key: 'available', label: 'Show "Open to work" badge', half: true },
      { type: 'checkbox', key: 'showPhoneOnSite', label: 'Show phone number on website', hint: 'The resume PDF always includes it.', half: true },
      {
        type: 'repeater',
        key: 'links',
        label: 'Links (LinkedIn, GitHub, blog, LeetCode…)',
        addLabel: 'Add link',
        newItem: () => ({ label: '', url: '', showOnResume: false }),
        itemTitle: (l) => l.label || l.url,
        fields: [
          { type: 'text', key: 'label', label: 'Label', placeholder: 'GitHub', half: true },
          { type: 'url', key: 'url', label: 'URL', placeholder: 'https://github.com/you', half: true },
          { type: 'checkbox', key: 'showOnResume', label: 'Also print on resume header' },
        ],
      },
    ],
    onSave: (v) => {
      const d = ctx.latest();
      // photo is managed by the uploader above, never by this form
      return ctx.save({ ...d, profile: { ...d.profile, ...v, photo: d.profile.photo } }, 'Profile saved');
    },
  };
}

export function aboutEditor(ctx: AdminCtx): EditorSpec {
  const d = ctx.latest();
  return {
    title: 'About',
    value: { summary: d.summary, about: d.about },
    fields: [
      { type: 'textarea', key: 'summary', label: 'Professional summary', rows: 6, hint: 'Used on the website and as the resume summary.' },
      { type: 'textarea', key: 'about', label: 'More about me (website only, optional)', rows: 5, hint: 'A more personal paragraph — hobbies, what drives you. Not printed on the resume.' },
    ],
    onSave: (v) => ctx.save({ ...ctx.latest(), summary: v.summary, about: v.about }, 'About saved'),
  };
}

export function skillsEditor(ctx: AdminCtx): EditorSpec {
  return {
    title: 'Skills',
    description: 'Groups appear as cards on the site and in the resume sidebar/section.',
    value: { skills: ctx.latest().skills },
    fields: [
      {
        type: 'repeater',
        key: 'skills',
        label: 'Skill groups',
        addLabel: 'Add group',
        newItem: () => ({ category: '', items: [] }),
        itemTitle: (g) => `${g.category || 'Group'} · ${(g.items || []).filter(Boolean).length} skills`,
        fields: [
          { type: 'text', key: 'category', label: 'Group name', placeholder: 'Backend' },
          { type: 'lines', key: 'items', label: 'Skills', rows: 6 },
        ],
      },
    ],
    onSave: (v) => ctx.save({ ...ctx.latest(), skills: v.skills }, 'Skills saved'),
  };
}

export function experienceEditor(ctx: AdminCtx): EditorSpec {
  return {
    title: 'Experience',
    value: { experience: ctx.latest().experience },
    fields: [
      {
        type: 'repeater',
        key: 'experience',
        label: 'Roles (most recent first)',
        addLabel: 'Add role',
        newItem: () => ({ id: newId('exp'), role: '', company: '', location: '', start: '', end: 'Present', tech: [], bullets: [] }),
        itemTitle: (x) => [x.role, x.company].filter(Boolean).join(' · '),
        fields: [
          { type: 'text', key: 'role', label: 'Role', half: true },
          { type: 'text', key: 'company', label: 'Company', half: true },
          { type: 'text', key: 'start', label: 'Start', half: true, hint: dateHint },
          { type: 'text', key: 'end', label: 'End', half: true },
          { type: 'text', key: 'location', label: 'Location (optional)' },
          { type: 'lines', key: 'tech', label: 'Tech stack', rows: 3 },
          { type: 'lines', key: 'bullets', label: 'Achievements / responsibilities', rows: 6 },
        ],
      },
    ],
    onSave: (v) => ctx.save({ ...ctx.latest(), experience: v.experience }, 'Experience saved'),
  };
}

export function educationEditor(ctx: AdminCtx): EditorSpec {
  return {
    title: 'Education',
    value: { education: ctx.latest().education },
    fields: [
      {
        type: 'repeater',
        key: 'education',
        label: 'Education',
        addLabel: 'Add education',
        newItem: () => ({ id: newId('edu'), degree: '', school: '', start: '', end: '', score: '' }),
        itemTitle: (x) => x.degree,
        fields: [
          { type: 'text', key: 'degree', label: 'Degree / course' },
          { type: 'text', key: 'school', label: 'Institution & place' },
          { type: 'text', key: 'start', label: 'Start', half: true },
          { type: 'text', key: 'end', label: 'End', half: true },
          { type: 'text', key: 'score', label: 'Score', placeholder: 'CGPA: 8.2 / 10' },
        ],
      },
    ],
    onSave: (v) => ctx.save({ ...ctx.latest(), education: v.education }, 'Education saved'),
  };
}

export function extrasEditor(ctx: AdminCtx): EditorSpec {
  const d = ctx.latest();
  return {
    title: 'Certifications & achievements',
    description: 'Optional — each section only appears (on the site and resume) when it has entries.',
    value: { certifications: d.certifications, achievements: d.achievements },
    fields: [
      {
        type: 'repeater',
        key: 'certifications',
        label: 'Certifications',
        addLabel: 'Add certification',
        newItem: () => ({ id: newId('cert'), name: '', issuer: '', date: '', url: '' }),
        itemTitle: (x) => x.name,
        fields: [
          { type: 'text', key: 'name', label: 'Name' },
          { type: 'text', key: 'issuer', label: 'Issuer', half: true },
          { type: 'text', key: 'date', label: 'Date', half: true },
          { type: 'url', key: 'url', label: 'Credential URL (optional)' },
        ],
      },
      { type: 'lines', key: 'achievements', label: 'Achievements', rows: 4 },
    ],
    onSave: (v) => ctx.save({ ...ctx.latest(), certifications: v.certifications, achievements: v.achievements }, 'Saved'),
  };
}

export function siteEditor(ctx: AdminCtx): EditorSpec {
  return {
    title: 'Website style',
    value: { ...ctx.latest().settings.site },
    fields: [
      { type: 'color', key: 'accent', label: 'Accent colour', half: true },
      {
        type: 'select',
        key: 'theme',
        label: 'Default theme',
        half: true,
        options: [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ],
        hint: 'Visitors can still switch with the sun/moon button.',
      },
    ],
    onSave: (v) => {
      const d = ctx.latest();
      return ctx.save({ ...d, settings: { ...d.settings, site: { ...d.settings.site, ...v } } }, 'Style saved');
    },
  };
}

export function projectEditor(ctx: AdminCtx, id: string | null): EditorSpec {
  const d = ctx.latest();
  const existing = id ? d.projects.find((p) => p.id === id) : undefined;
  const project: Project = existing ?? {
    id: newId('proj'),
    name: '',
    subtitle: '',
    start: '',
    end: '',
    tech: [],
    summary: '',
    bullets: [],
    demo: '',
    repo: '',
    links: [],
    images: [],
    autoPreview: true,
    featured: false,
  };
  const inResume = d.settings.resume.projectIds.includes(project.id);

  const fields: Field[] = [
    { type: 'text', key: 'name', label: 'Project name', half: true },
    { type: 'text', key: 'subtitle', label: 'Short tagline', placeholder: 'Generative AI Web App', half: true },
    { type: 'text', key: 'start', label: 'Start', half: true, hint: dateHint },
    { type: 'text', key: 'end', label: 'End', half: true },
    { type: 'textarea', key: 'summary', label: 'Card description (website)', rows: 3, hint: 'One or two sentences shown on the project card.' },
    { type: 'lines', key: 'bullets', label: 'Highlights', rows: 5, hint: 'Shown in the project details and printed on the resume.' },
    { type: 'lines', key: 'tech', label: 'Tech stack', rows: 3 },
    { type: 'url', key: 'demo', label: 'Live / deployed URL', placeholder: 'https://my-app.vercel.app', half: true, hint: 'The card shows a live picture of this front page.' },
    { type: 'url', key: 'repo', label: 'GitHub repo URL', placeholder: 'https://github.com/Prathmesh-Dubey/…', half: true, hint: 'Clicking the card opens the live site, or this repo if there is none.' },
    { type: 'images', key: 'images', label: 'Screenshots (optional)', hint: 'Upload or paste screenshots. They replace the automatic preview; the first one is the cover.' },
    {
      type: 'repeater',
      key: 'links',
      label: 'More links (optional)',
      hint: 'Video demo, case study, docs… The resume prints the live site and GitHub first.',
      addLabel: 'Add link',
      newItem: () => ({ label: '', url: '' }),
      itemTitle: (l) => l.label || l.url,
      fields: [
        { type: 'text', key: 'label', label: 'Label', placeholder: 'Video demo', half: true },
        { type: 'url', key: 'url', label: 'URL', placeholder: 'https://…', half: true },
      ],
    },
    { type: 'checkbox', key: 'autoPreview', label: 'Automatic preview', hint: 'With no screenshots, show the live site (or the GitHub preview card).', half: true },
    { type: 'checkbox', key: 'featured', label: 'Featured', hint: 'Adds a Featured badge.', half: true },
    { type: 'checkbox', key: 'inResume', label: `Include in resume PDF (max ${MAX_RESUME_PROJECTS})` },
  ];

  return {
    title: existing ? `Edit “${existing.name}”` : 'New project',
    value: { ...project, inResume },
    fields,
    onSave: async ({ inResume: wantResume, ...v }) => {
      const cur = ctx.latest();
      const next: Project = { ...(v as Project), id: project.id };
      if (!next.name?.trim()) {
        ctx.notify('Give the project a name', 'error');
        throw new Error('name');
      }
      const projects = existing ? cur.projects.map((p) => (p.id === project.id ? next : p)) : [...cur.projects, next];
      let ids = cur.settings.resume.projectIds.filter((x) => x !== project.id);
      if (wantResume) {
        const wasIn = cur.settings.resume.projectIds.includes(project.id);
        if (!wasIn && ids.length >= MAX_RESUME_PROJECTS) {
          ctx.notify(`The resume already has ${MAX_RESUME_PROJECTS} projects — untick one first.`, 'error');
          throw new Error('limit');
        }
        ids = wasIn ? cur.settings.resume.projectIds : [...ids, project.id];
      }
      return ctx.save({ ...cur, projects, settings: { ...cur.settings, resume: { ...cur.settings.resume, projectIds: ids } } }, existing ? 'Project saved' : 'Project added');
    },
    danger: existing
      ? {
          label: 'Delete project',
          onClick: async () => {
            if (!confirm(`Delete “${existing.name}”? This can't be undone from the site (a backup is kept in data/backups).`)) throw new Error('cancel');
            const cur = ctx.latest();
            return ctx.save({ ...cur, projects: cur.projects.filter((p) => p.id !== existing.id) }, 'Project deleted');
          },
        }
      : undefined,
  };
}

// ---------- the one stored file: profile photo ----------

function PhotoUploader({ ctx }: { ctx: AdminCtx }) {
  const tenantUrl = useTenantUrl();
  const input = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState(ctx.latest().profile.photo);
  const [busy, setBusy] = useState(false);

  const send = async (method: 'POST' | 'DELETE', file?: File) => {
    setBusy(true);
    try {
      const body = file ? new FormData() : undefined;
      if (file) body!.append('photo', file);
      const res = await fetch('/api/photo', { method, body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      ctx.setData(json);
      setVersion(json.profile.photo);
      ctx.notify(file ? 'Photo updated' : 'Photo removed');
    } catch (e) {
      ctx.notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="photo-field">
      <div className="photo-preview">
        {version ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenantUrl(`/api/photo?v=${version}`)} alt="Profile" />
        ) : (
          <Icon name="image" size={28} />
        )}
      </div>
      <div>
        <span className="label">Profile photo</span>
        <small className="hint">JPG or PNG, under 4 MB. Square works best. This is the only file the site stores.</small>
        <div className="row-gap">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => input.current?.click()}>
            <Icon name="upload" size={16} /> {version ? 'Replace' : 'Upload'}
          </button>
          {version && (
            <button type="button" className="btn btn-ghost danger" disabled={busy} onClick={() => confirm('Remove your photo?') && send('DELETE')}>
              <Icon name="trash" size={16} /> Remove
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => e.target.files?.[0] && send('POST', e.target.files[0])} />
      </div>
    </div>
  );
}

// ---------- account: change password ----------

export function accountEditor(ctx: AdminCtx, email: string): EditorSpec {
  return {
    title: 'Account & password',
    description: `Signed in as ${email}. Forgot it later? Use "Forgot password?" on the sign-in page and a code is sent to this Gmail.`,
    value: { current: '', next: '', confirm: '' },
    fields: [
      { type: 'password', key: 'current', label: 'Current password', autoComplete: 'current-password' },
      { type: 'password', key: 'next', label: 'New password', autoComplete: 'new-password', half: true, hint: 'At least 6 characters.' },
      { type: 'password', key: 'confirm', label: 'Confirm new password', autoComplete: 'new-password', half: true },
    ],
    submitLabel: 'Change password',
    onSave: async (v) => {
      if (v.next !== v.confirm) {
        ctx.notify('The two new passwords do not match', 'error');
        throw new Error('mismatch');
      }
      const res = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: v.current, next: v.next }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        ctx.notify(json.error || 'Could not change password', 'error');
        throw new Error('failed');
      }
      ctx.notify('Password changed');
    },
  };
}
