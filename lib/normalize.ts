import { MAX_RESUME_PROJECTS, isTemplate, type Portfolio } from './types';

// Every save goes through normalize(), so the stored JSON always has a predictable shape and
// nothing unsafe (javascript: links, unknown keys, huge strings) can get in. Shared by client and server.

/* eslint-disable @typescript-eslint/no-explicit-any */
const str = (v: any, max = 2000) => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim().slice(0, max);
const bool = (v: any) => v === true || v === 'true';
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
const lines = (v: any, max = 600) => arr(v).map((s) => str(s, max)).filter(Boolean);
const color = (v: any, fallback: string) => (/^#[0-9a-f]{6}$/i.test(v || '') ? String(v).toLowerCase() : fallback);
const defaultTrue = (v: any) => v !== false && v !== 'false';

export const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const id = (v: any, prefix: string) => (/^[\w-]{1,64}$/.test(v || '') ? String(v) : newId(prefix));

/** Accepts http(s), mailto:, tel:, and bare domains ("github.com/me" → https://github.com/me). Everything else → ''. */
export function safeUrl(v: any): string {
  const s = str(v, 1000);
  if (!s) return '';
  if (/^(mailto:|tel:)/i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s).href;
    } catch {
      return '';
    }
  }
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return safeUrl('https://' + s);
  return '';
}

export const UPLOAD_RE = /^\/api\/uploads\/[\w-]+\.(jpg|png|webp)(\?u=[a-z0-9-]{3,30})?$/;
const webUrl = (v: any) => {
  const u = safeUrl(v);
  return /^https?:/.test(u) ? u : '';
};

export function normalize(input: any): Portfolio {
  const d = input && typeof input === 'object' ? input : {};
  const p = d.profile || {};
  const r = d.settings?.resume || {};
  const site = d.settings?.site || {};

  const projects = arr(d.projects)
    .map((x) => ({
      id: id(x?.id, 'proj'),
      name: str(x?.name, 120),
      subtitle: str(x?.subtitle, 160),
      start: str(x?.start, 30),
      end: str(x?.end, 30),
      tech: lines(x?.tech, 80),
      summary: str(x?.summary, 1500),
      bullets: lines(x?.bullets),
      demo: webUrl(x?.demo),
      repo: webUrl(x?.repo),
      links: arr(x?.links)
        .map((l) => ({ label: str(l?.label, 40), url: safeUrl(l?.url) }))
        .filter((l) => l.url),
      images: arr(x?.images)
        .map((u) => (UPLOAD_RE.test(String(u)) ? String(u) : webUrl(u)))
        .filter(Boolean),
      autoPreview: defaultTrue(x?.autoPreview),
      featured: bool(x?.featured),
    }))
    .filter((x) => x.name);
  const projectIds = new Set(projects.map((x) => x.id));

  return {
    updatedAt: str(d.updatedAt, 40),
    profile: {
      name: str(p.name, 100),
      title: str(p.title, 160),
      tagline: str(p.tagline, 400),
      location: str(p.location, 120),
      phone: str(p.phone, 40),
      email: str(p.email, 120),
      photo: /^[\w-]{0,40}$/.test(p.photo || '') ? str(p.photo) : '',
      available: bool(p.available),
      showPhoneOnSite: bool(p.showPhoneOnSite),
      links: arr(p.links)
        .map((l) => ({ label: str(l?.label, 40), url: safeUrl(l?.url), showOnResume: defaultTrue(l?.showOnResume) }))
        .filter((l) => l.url),
    },
    summary: str(d.summary, 3000),
    about: str(d.about, 5000),
    skills: arr(d.skills)
      .map((g) => ({ category: str(g?.category, 60), items: lines(g?.items, 120) }))
      .filter((g) => g.category || g.items.length),
    experience: arr(d.experience)
      .map((x) => ({
        id: id(x?.id, 'exp'),
        role: str(x?.role, 120),
        company: str(x?.company, 120),
        location: str(x?.location, 120),
        start: str(x?.start, 30),
        end: str(x?.end, 30),
        tech: lines(x?.tech, 80),
        bullets: lines(x?.bullets),
      }))
      .filter((x) => x.role || x.company),
    projects,
    education: arr(d.education)
      .map((x) => ({
        id: id(x?.id, 'edu'),
        degree: str(x?.degree, 160),
        school: str(x?.school, 200),
        start: str(x?.start, 30),
        end: str(x?.end, 30),
        score: str(x?.score, 60),
      }))
      .filter((x) => x.degree || x.school),
    certifications: arr(d.certifications)
      .map((x) => ({ id: id(x?.id, 'cert'), name: str(x?.name, 160), course: str(x?.course, 120), issuer: str(x?.issuer, 120), date: str(x?.date, 30), url: safeUrl(x?.url) }))
      .filter((x) => x.name || x.course),
    achievements: lines(d.achievements),
    settings: {
      resume: {
        template: isTemplate(r.template) ? r.template : 'creative',
        paper: r.paper === 'A4' ? 'A4' : 'Letter',
        accent: color(r.accent, '#1a365d'),
        fitOnePage: defaultTrue(r.fitOnePage),
        showPhoto: bool(r.showPhoto),
        showProjectLinks: defaultTrue(r.showProjectLinks),
        // keep order, drop unknown/duplicate ids, cap at 3
        projectIds: [...new Set(arr(r.projectIds).map(String))].filter((x) => projectIds.has(x)).slice(0, MAX_RESUME_PROJECTS),
        source: r.source === 'uploaded' ? 'uploaded' : 'generated',
        uploadedName: str(r.uploadedName, 120).replace(/[^\w .()-]/g, ''),
      },
      site: { accent: color(site.accent, '#7c5cff'), theme: site.theme === 'dark' ? 'dark' : 'light' },
    },
  };
}
