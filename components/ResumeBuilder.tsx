'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Fields, type Field } from './admin/Form';
import { BrandLogo } from './BrandLogo';
import { PdfPreview } from './admin/PdfPreview';
import { Icon } from './Icons';
import { inNativeApp, saveFile } from './nativeApp';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>;
type Built = { bytes: ArrayBuffer; url: string; pages: number };
type State = {
  basics: Obj;
  skills: Obj;
  experience: Obj;
  projects: Obj;
  education: Obj;
  extras: Obj;
  design: { template: 'creative' | 'classic'; paper: 'Letter' | 'A4'; accent: string; fitOnePage: boolean };
};

// v3: older drafts (the Aarav Sharma demo, or the auto-filled example) are ignored.
const STORAGE_KEY = 'pf-resume-builder-v3';
const SWATCHES = ['#1a365d', '#0f766e', '#4338ca', '#7c3aed', '#be123c', '#b45309', '#0e7490', '#111827'];
const uid = () => Math.random().toString(36).slice(2, 10);

const EMPTY: State = {
  basics: { name: '', title: '', location: '', phone: '', email: '', summary: '', links: [] },
  skills: { skills: [] },
  experience: { experience: [] },
  projects: { projects: [] },
  education: { education: [] },
  extras: { certifications: [], achievements: [] },
  design: { template: 'creative', paper: 'A4', accent: '#1a365d', fitOnePage: true },
};

const GITHUB = 'https://github.com/Prathmesh-Dubey';

// Offline fallback for "Load example"; normally the example is loaded live from the portfolio (see loadExample).
const EXAMPLE: State = {
  basics: {
    name: 'Prathmesh Dubey',
    title: 'AI/ML Engineer | Full-Stack Software Engineer',
    location: 'Pune, Maharashtra, India',
    phone: '',
    email: 'prathmdubey217@gmail.com',
    summary:
      'Software engineer with hands-on experience shipping AI-powered, production-grade web applications, integrating Large Language Models into real product workflows on a full-stack base of Java, Spring Boot, Python, React and Next.js.',
    links: [
      { label: 'GitHub', url: GITHUB },
      { label: 'LinkedIn', url: 'https://linkedin.com/in/prathmesh-dubey-19418b361' },
    ],
  },
  skills: {
    skills: [
      { category: 'Languages', items: ['Python', 'Java', 'JavaScript', 'TypeScript', 'SQL'] },
      { category: 'Backend', items: ['Spring Boot', 'Node.js', 'FastAPI', 'REST APIs'] },
      { category: 'Frontend', items: ['React.js', 'Next.js', 'Tailwind CSS'] },
    ],
  },
  experience: {
    experience: [
      {
        id: uid(),
        role: 'Software Engineer Intern',
        company: 'Chedo Tech',
        location: '',
        start: 'Mar 2026',
        end: 'Present',
        tech: ['Java', 'Spring Boot', 'React.js', 'Next.js'],
        bullets: ['Build and ship production features across Spring Boot back-end services and React/Next.js front-ends.'],
      },
    ],
  },
  projects: {
    projects: [
      {
        id: uid(),
        name: 'MedSyncAI',
        subtitle: 'AI-Assisted Healthcare Platform',
        start: 'Jan 2026',
        end: 'Present',
        tech: ['React', 'Spring Boot', 'MongoDB', 'DeepSeek API'],
        bullets: ['Full-stack clinic platform with a DeepSeek-powered assistant grounded in the clinic\'s own records.'],
        demo: '',
        repo: GITHUB,
      },
    ],
  },
  education: {
    education: [{ id: uid(), degree: 'B.Tech, Computer Science & Engineering', school: 'Thakur Shivkumarsingh Memorial Engineering College, Burhanpur, India', start: '2022', end: '2026', score: 'CGPA: 7.0 / 10' }],
  },
  extras: { certifications: [], achievements: [] },
  design: { template: 'creative', paper: 'A4', accent: '#1a365d', fitOnePage: true },
};

/** Builds the example from the live portfolio, so it always shows Prathmesh Dubey's current details. */
async function loadExample(): Promise<State> {
  try {
    const d = await fetch('/api/portfolio', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject()));
    const links: Obj[] = d.profile.links.map((l: Obj) => ({ label: l.label, url: l.url }));
    if (!links.some((l) => /github\.com/i.test(l.url))) links.unshift({ label: 'GitHub', url: GITHUB });
    // projects chosen for the resume come first (the builder prints the first 3)
    const chosen: string[] = d.settings.resume.projectIds;
    const projects = [...d.projects].sort((a: Obj, b: Obj) => {
      const ia = chosen.indexOf(a.id);
      const ib = chosen.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return {
      basics: { name: d.profile.name, title: d.profile.title, location: d.profile.location, phone: d.profile.phone, email: d.profile.email, summary: d.summary, links },
      skills: { skills: d.skills },
      experience: { experience: d.experience },
      projects: {
        projects: projects.map((p: Obj) => ({
          id: p.id,
          name: p.name,
          subtitle: p.subtitle,
          start: p.start,
          end: p.end,
          tech: p.tech,
          bullets: p.bullets.length ? p.bullets : p.summary ? [p.summary] : [],
          demo: p.demo,
          repo: p.repo || GITHUB,
        })),
      },
      education: { education: d.education },
      extras: { certifications: d.certifications, achievements: d.achievements },
      design: { template: d.settings.resume.template, paper: d.settings.resume.paper, accent: d.settings.resume.accent, fitOnePage: true },
    };
  } catch {
    return EXAMPLE;
  }
}

const date = { half: true, hint: 'Written exactly as you type it, e.g. "Jun 2025" or "Present".' };

const SECTIONS: { key: keyof State; title: string; icon: Parameters<typeof Icon>[0]['name']; fields: Field[] }[] = [
  {
    key: 'basics',
    title: 'Personal details',
    icon: 'edit',
    fields: [
      { type: 'text', key: 'name', label: 'Full name', half: true, placeholder: 'Prathmesh Dubey' },
      { type: 'text', key: 'title', label: 'Headline', half: true, placeholder: 'AI/ML Engineer | Full-Stack Software Engineer' },
      { type: 'email', key: 'email', label: 'Email', half: true, placeholder: 'prathmdubey217@gmail.com' },
      { type: 'text', key: 'phone', label: 'Phone', half: true, placeholder: '+91 93026 22997' },
      { type: 'text', key: 'location', label: 'Current location', placeholder: 'Pune, Maharashtra, India' },
      { type: 'textarea', key: 'summary', label: 'Professional summary', rows: 4, placeholder: 'Software engineer with hands-on experience shipping AI-powered, production-grade web applications…' },
      {
        type: 'repeater',
        key: 'links',
        label: 'Links',
        addLabel: 'Add link',
        newItem: () => ({ label: '', url: '' }),
        itemTitle: (l) => l.label || l.url,
        fields: [
          { type: 'text', key: 'label', label: 'Label', placeholder: 'GitHub', half: true },
          { type: 'url', key: 'url', label: 'URL', placeholder: 'https://github.com/Prathmesh-Dubey', half: true },
        ],
      },
    ],
  },
  {
    key: 'skills',
    title: 'Skills',
    icon: 'code',
    fields: [
      {
        type: 'repeater',
        key: 'skills',
        label: 'Skill groups',
        addLabel: 'Add skill group',
        newItem: () => ({ category: '', items: [] }),
        itemTitle: (g) => g.category,
        fields: [
          { type: 'text', key: 'category', label: 'Group', placeholder: 'Languages' },
          { type: 'lines', key: 'items', label: 'Skills', rows: 4, placeholder: 'Python\nJava\nJavaScript' },
        ],
      },
    ],
  },
  {
    key: 'experience',
    title: 'Experience',
    icon: 'briefcase',
    fields: [
      {
        type: 'repeater',
        key: 'experience',
        label: 'Jobs & internships (most recent first)',
        addLabel: 'Add experience',
        newItem: () => ({ id: uid(), role: '', company: '', location: '', start: '', end: 'Present', tech: [], bullets: [] }),
        itemTitle: (x) => [x.role, x.company].filter(Boolean).join(' · '),
        fields: [
          { type: 'text', key: 'role', label: 'Role', half: true, placeholder: 'Software Engineer Intern' },
          { type: 'text', key: 'company', label: 'Company', half: true, placeholder: 'Chedo Tech' },
          { type: 'text', key: 'start', label: 'Start', ...date },
          { type: 'text', key: 'end', label: 'End', half: true },
          { type: 'lines', key: 'tech', label: 'Tech used', rows: 2 },
          { type: 'lines', key: 'bullets', label: 'What you did', rows: 4, placeholder: 'Built and shipped production features across Spring Boot and React/Next.js' },
        ],
      },
    ],
  },
  {
    key: 'projects',
    title: 'Projects',
    icon: 'sparkle',
    fields: [
      {
        type: 'repeater',
        key: 'projects',
        label: 'Projects (the first 3 are printed)',
        addLabel: 'Add project',
        newItem: () => ({ id: uid(), name: '', subtitle: '', start: '', end: '', tech: [], bullets: [], demo: '', repo: '' }),
        itemTitle: (x) => x.name,
        fields: [
          { type: 'text', key: 'name', label: 'Project name', half: true, placeholder: 'MedSyncAI' },
          { type: 'text', key: 'subtitle', label: 'Short tagline', half: true, placeholder: 'AI-Assisted Healthcare Platform' },
          { type: 'text', key: 'start', label: 'Start', ...date },
          { type: 'text', key: 'end', label: 'End', half: true },
          { type: 'url', key: 'demo', label: 'Live URL', half: true },
          { type: 'url', key: 'repo', label: 'GitHub URL', half: true, placeholder: 'https://github.com/Prathmesh-Dubey' },
          { type: 'lines', key: 'tech', label: 'Tech used', rows: 2 },
          { type: 'lines', key: 'bullets', label: 'Highlights', rows: 3 },
        ],
      },
    ],
  },
  {
    key: 'education',
    title: 'Education',
    icon: 'cap',
    fields: [
      {
        type: 'repeater',
        key: 'education',
        label: 'Education',
        addLabel: 'Add education',
        newItem: () => ({ id: uid(), degree: '', school: '', start: '', end: '', score: '' }),
        itemTitle: (x) => x.degree,
        fields: [
          { type: 'text', key: 'degree', label: 'Degree / course', placeholder: 'B.Tech, Computer Science & Engineering' },
          { type: 'text', key: 'school', label: 'Institution & place' },
          { type: 'text', key: 'start', label: 'Start', half: true },
          { type: 'text', key: 'end', label: 'End', half: true },
          { type: 'text', key: 'score', label: 'Score', placeholder: 'CGPA: 7.0 / 10' },
        ],
      },
    ],
  },
  {
    key: 'extras',
    title: 'Certifications & achievements',
    icon: 'award',
    fields: [
      {
        type: 'repeater',
        key: 'certifications',
        label: 'Certifications',
        addLabel: 'Add certification',
        newItem: () => ({ id: uid(), name: '', course: '', issuer: '', date: '', url: '' }),
        itemTitle: (x) => [x.name, x.course].filter(Boolean).join(' · '),
        fields: [
          { type: 'text', key: 'name', label: 'Certificate name', placeholder: 'Oracle Certified Java Programmer' },
          { type: 'text', key: 'course', label: 'Course / specialization', placeholder: 'Java Full Stack' },
          { type: 'text', key: 'issuer', label: 'Issuer', half: true, placeholder: 'Oracle' },
          { type: 'text', key: 'date', label: 'Date', half: true, placeholder: 'Mar 2026' },
          { type: 'url', key: 'url', label: 'Certificate URL', placeholder: 'https://… (link where anyone can view it)' },
        ],
      },
      { type: 'lines', key: 'achievements', label: 'Achievements', rows: 3 },
    ],
  },
];

function toPayload(s: State) {
  return {
    profile: { ...s.basics, links: (s.basics.links || []).map((l: Obj) => ({ ...l, showOnResume: true })), available: false, showPhoneOnSite: true },
    summary: s.basics.summary,
    skills: s.skills.skills,
    experience: s.experience.experience,
    projects: s.projects.projects,
    education: s.education.education,
    certifications: s.extras.certifications,
    achievements: s.extras.achievements,
    settings: { resume: { ...s.design, showPhoto: false, showProjectLinks: true, projectIds: [] } },
  };
}

type Account = { name: string; email: string } | null;
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function ResumeBuilder({ account = null }: { account?: Account }) {
  const signedIn = Boolean(account);
  const [state, setState] = useState<State>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<keyof State>('basics');
  const [pdf, setPdf] = useState<Built | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // What the account last saved on the server, so unchanged drafts aren't re-sent.
  const lastSaved = useRef('');
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Restore the draft: a signed-in account's saved resume first, else this browser's own draft; otherwise the form
  // starts empty (the example only shows as hints + preview).
  useEffect(() => {
    let local: State | null = null;
    try {
      local = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      /* private mode / bad data */
    }
    try {
      ['pf-resume-builder', 'pf-resume-builder-v2'].forEach((k) => localStorage.removeItem(k)); // old drafts
    } catch {
      /* ignore */
    }
    if (local && (!local.basics || /aarav/i.test(`${local.basics.name} ${local.basics.email}`))) local = null;
    if (local && JSON.stringify({ ...EMPTY, ...local }) === JSON.stringify(EMPTY)) local = null; // an untouched form isn't a draft
    let cancelled = false;
    (async () => {
      let remote: State | null = null;
      if (signedIn) {
        try {
          const r = await fetch('/api/account/resume', { cache: 'no-store' });
          const draft = r.ok ? (await r.json()).draft : null;
          if (draft?.basics) remote = draft;
        } catch {
          /* offline: keep the browser copy */
        }
      }
      if (cancelled) return;
      const start = remote ?? local;
      const initial = start ? { ...EMPTY, ...start } : EMPTY;
      // a browser-only draft still needs uploading to a fresh account; anything else is already in sync
      lastSaved.current = signedIn && !remote && local ? '' : JSON.stringify(initial);
      setState(initial);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  // Signed-in accounts: save the draft to the site shortly after typing stops, so it opens on any device.
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!loaded || !signedIn) return;
    const text = JSON.stringify(state);
    if (text === lastSaved.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState('saving');
      try {
        const r = await fetch('/api/account/resume', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft: state }) });
        if (!r.ok) throw new Error();
        lastSaved.current = text;
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 1200);
    return () => clearTimeout(saveTimer.current);
  }, [state, loaded, signedIn]);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    try {
      localStorage.removeItem(STORAGE_KEY); // don't leave this account's resume on a shared device
    } catch {
      /* ignore */
    }
    window.location.replace('/resume-builder');
  };

  const hasName = Boolean(state.basics.name?.trim());

  // Built PDFs keyed by their exact content, so switching back and forth (e.g. Creative ⇄ Classic) is instant.
  const built = useRef(new Map<string, Promise<Built>>());
  const designChange = useRef(false);
  const requestId = useRef(0);

  const buildPdf = useCallback((payload: Obj): Promise<Built> => {
    const key = JSON.stringify(payload);
    const hit = built.current.get(key);
    if (hit) return hit;
    const job = (async () => {
      const res = await fetch('/api/resume/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not build the PDF');
      const blob = await res.blob();
      return { bytes: await blob.arrayBuffer(), url: URL.createObjectURL(blob), pages: Number(res.headers.get('X-Resume-Pages')) };
    })();
    job.catch(() => built.current.delete(key));
    built.current.set(key, job);
    if (built.current.size > 20) built.current.delete(built.current.keys().next().value!);
    return job;
  }, []);

  // Rebuild the PDF after typing pauses; design clicks (template, colour, paper) update right away.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    if (!state.basics.name?.trim()) return;
    const payload = toPayload(state);
    const cached = built.current.has(JSON.stringify(payload));
    const delay = cached ? 0 : designChange.current ? 30 : 700;
    designChange.current = false;
    const id = ++requestId.current;

    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!cached) setBusy(true);
      try {
        const result = await buildPdf(payload);
        if (id !== requestId.current) return; // a newer edit is on its way
        setPdf(result);
        setError('');
        // Warm up the other template so switching to it is instant.
        const other = payload.settings.resume.template === 'classic' ? 'creative' : 'classic';
        buildPdf({ ...payload, settings: { resume: { ...payload.settings.resume, template: other } } }).catch(() => {});
      } catch (e) {
        if (id === requestId.current) setError((e as Error).message);
      } finally {
        if (id === requestId.current) setBusy(false);
      }
    }, delay);
    return () => clearTimeout(timer.current);
  }, [state, loaded, buildPdf]);

  // While the form is empty, preview a sample resume (Prathmesh Dubey) in the chosen design — template, colour
  // and paper follow the Design controls, and both templates are pre-built so switching is instant.
  const [examplePdf, setExamplePdf] = useState<Built | null>(null);
  const exampleData = useRef<Promise<State> | null>(null);
  useEffect(() => {
    if (!loaded || hasName) return;
    let cancelled = false;
    (async () => {
      try {
        exampleData.current ??= loadExample();
        const example = await exampleData.current;
        const payload = toPayload({ ...example, design: state.design });
        const result = await buildPdf(payload);
        if (cancelled) return;
        setExamplePdf(result);
        const other = state.design.template === 'classic' ? 'creative' : 'classic';
        buildPdf({ ...payload, settings: { resume: { ...payload.settings.resume, template: other } } }).catch(() => {});
      } catch {
        /* the empty-state message stays */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, hasName, state.design, buildPdf]);

  const setDesign = (patch: Partial<State['design']>) => {
    designChange.current = true;
    setState((s) => ({ ...s, design: { ...s.design, ...patch } }));
  };

  const set = (key: keyof State, value: Obj) => setState((s) => ({ ...s, [key]: value }));
  const fileName = `${(state.basics.name || 'My').trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}-Resume.pdf`;

  return (
    <div className="site builder-page">
      <div className="bg-glow" aria-hidden="true" />
      <nav className="nav scrolled">
        <div className="wrap nav-inner">
          <Link href="/" className="btn btn-ghost btn-sm">
            ← Back to portfolio
          </Link>
          <span className="builder-title">
            <BrandLogo size={40} />
            Free resume builder
          </span>
          <span className="builder-account">
            {account ? (
              <>
                <span className="builder-user" title={account.email}>
                  <Icon name="user" size={15} /> {account.name}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">
                  Sign in
                </Link>
                <Link href="/login?mode=signup" className="btn btn-primary btn-sm">
                  Create free account
                </Link>
              </>
            )}
          </span>
        </div>
      </nav>

      <div className="wrap builder">
        <div className="builder-form">
          <div className="builder-intro">
            <h1>Build your resume in minutes</h1>
            {account ? (
              <p className="muted">
                Fill in your details and watch the PDF update live. Your resume is saved to your account ({account.email}) as you type
                {saveState === 'saving' ? ' · Saving…' : saveState === 'saved' ? ' · ✓ Saved' : saveState === 'error' ? ' · Couldn’t save, will retry on your next edit' : ''}.
              </p>
            ) : (
              <p className="muted">
                Fill in your details and watch the PDF update live. Your draft stays in this browser.{' '}
                <Link href="/login?mode=signup">Create a free account</Link> to keep it safe and open it on any device.
              </p>
            )}
            <div className="row-gap">
              <button className="btn btn-ghost btn-sm" onClick={async () => confirm('Replace your entries with the example (Prathmesh Dubey)?') && setState(await loadExample())}>
                <Icon name="file" size={15} /> Load example
              </button>
              <button className="btn btn-ghost btn-sm danger" onClick={() => confirm('Clear everything?') && (setState(EMPTY), setPdf(null))}>
                <Icon name="trash" size={15} /> Clear all
              </button>
            </div>
          </div>

          <section className="card builder-card">
            <h2 className="builder-h">
              <Icon name="settings" size={18} /> Design
            </h2>
            <div className="tpl-grid">
              {(['creative', 'classic'] as const).map((t) => (
                <button key={t} className={`tpl ${state.design.template === t ? 'on' : ''}`} onClick={() => setDesign({ template: t })}>
                  <span className={`tpl-thumb ${t}`} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>{t === 'creative' ? 'Creative' : 'Classic ATS'}</b>
                  <small>{t === 'creative' ? 'Two-column, modern' : 'Single column, recruiter-friendly'}</small>
                </button>
              ))}
            </div>
            <div className="builder-design-row">
              <div className="swatches">
                {SWATCHES.map((c) => (
                  <button key={c} className={`swatch ${state.design.accent === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setDesign({ accent: c })} aria-label={c} />
                ))}
              </div>
              <select value={state.design.paper} onChange={(e) => setDesign({ paper: e.target.value as State['design']['paper'] })} aria-label="Paper size">
                <option value="A4">A4</option>
                <option value="Letter">US Letter</option>
              </select>
            </div>
          </section>

          {SECTIONS.map((sec) => (
            <section key={sec.key} className={`card builder-card ${open === sec.key ? 'open' : ''}`}>
              <button className="builder-h toggle-h" onClick={() => setOpen(open === sec.key ? ('design' as keyof State) : sec.key)} aria-expanded={open === sec.key}>
                <Icon name={sec.icon} size={18} /> {sec.title}
                <Icon name={open === sec.key ? 'up' : 'down'} size={16} className="chev" />
              </button>
              {open === sec.key && <Fields fields={sec.fields} value={state[sec.key] as Obj} onChange={(v) => set(sec.key, v)} />}
            </section>
          ))}
        </div>

        <aside className="builder-preview">
          <div className="builder-bar">
            <span className="muted small">
              {!hasName
                ? examplePdf
                  ? 'Example: Prathmesh Dubey. Fill in the form to build yours'
                  : 'Enter your name to start the preview'
                : busy
                  ? 'Updating preview…'
                  : error
                    ? error
                    : pdf
                      ? pdf.pages === 1
                        ? '✓ Fits on one page'
                        : `${pdf.pages} pages — trim a little to fit one`
                      : ''}
            </span>
            <a
              className={`btn btn-primary ${pdf && hasName ? '' : 'disabled'}`}
              href={hasName ? pdf?.url : undefined}
              download={fileName}
              aria-disabled={!pdf || !hasName}
              onClick={(e) => {
                // the Android app can't follow blob: download links, so hand the PDF to the app instead
                if (pdf && hasName && inNativeApp()) {
                  e.preventDefault();
                  saveFile(new Blob([pdf.bytes], { type: 'application/pdf' }), fileName);
                }
              }}
            >
              <Icon name="download" size={16} /> Download PDF
            </a>
          </div>
          <div className="builder-pages">
            {hasName && pdf ? (
              <PdfPreview bytes={pdf.bytes} />
            ) : !hasName && examplePdf ? (
              <>
                <span className="example-badge">Example</span>
                <PdfPreview bytes={examplePdf.bytes} />
              </>
            ) : (
              <div className="builder-empty">
                <Icon name="file" size={40} />
                <p>Your resume preview appears here.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
