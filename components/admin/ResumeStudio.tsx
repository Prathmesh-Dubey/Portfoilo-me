'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_RESUME_PROJECTS, type Portfolio, type ResumeSettings } from '@/lib/types';
import { Icon } from '../Icons';
import type { AdminCtx } from './editors';
import { PdfPreview } from './PdfPreview';
import { useTenantUrl } from '../TenantContext';

type Built = { bytes: ArrayBuffer; url: string; info: { pages: number; scale: number } | null };

const SWATCHES = ['#1a365d', '#0f766e', '#4338ca', '#7c3aed', '#be123c', '#b45309', '#0e7490', '#111827'];

export function ResumeStudio({ data, ctx, onClose }: { data: Portfolio; ctx: AdminCtx; onClose: () => void }) {
  const tu = useTenantUrl();
  const r = data.settings.resume;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [info, setInfo] = useState<{ pages: number; scale: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [accent, setAccent] = useState(r.accent);
  const [uploading, setUploading] = useState(false);
  const accentTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pdfInput = useRef<HTMLInputElement>(null);
  const showingUpload = r.source === 'uploaded' && Boolean(r.uploadedName);

  // PDFs already fetched, keyed by saved-version + template, so Creative ⇄ Classic switches instantly.
  const built = useRef(new Map<string, Promise<Built>>());
  const getPdf = useCallback((url: string, key: string, generated: boolean): Promise<Built> => {
    const hit = built.current.get(key);
    if (hit) return hit;
    const job = (async () => {
      const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not build the PDF');
      const blob = await res.blob();
      return {
        bytes: await blob.arrayBuffer(),
        url: URL.createObjectURL(blob),
        info: generated ? { pages: Number(res.headers.get('X-Resume-Pages')), scale: Number(res.headers.get('X-Resume-Scale')) } : null,
      };
    })();
    job.catch(() => built.current.delete(key));
    built.current.set(key, job);
    if (built.current.size > 12) built.current.delete(built.current.keys().next().value!);
    return job;
  }, []);

  const show = (b: Built) => {
    setPdfUrl(b.url);
    setBytes(b.bytes);
    setInfo(b.info);
    setError('');
  };

  // Preview = the real PDF bytes of whatever visitors will download.
  useEffect(() => {
    let cancelled = false;
    const other = r.template === 'classic' ? 'creative' : 'classic';
    (async () => {
      const key = showingUpload ? `upload|${data.updatedAt}` : `gen|${data.updatedAt}|${r.template}`;
      if (!built.current.has(key)) setLoading(true);
      try {
        const b = await getPdf(tu(showingUpload ? '/api/resume/file' : '/api/resume'), key, !showingUpload);
        if (cancelled) return;
        setPdfUrl(b.url);
        setBytes(b.bytes);
        setInfo(b.info);
        setError('');
        // Pre-build the other template in the background so switching to it is instant.
        if (!showingUpload) getPdf(tu(`/api/resume?template=${other}`), `gen|${data.updatedAt}|${other}`, true).catch(() => {});
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, showingUpload, r.template, getPdf]); // eslint-disable-line react-hooks/exhaustive-deps -- tu only depends on the (fixed) tenant

  /** Switch template: show the pre-built preview immediately, save in the background. */
  const pickTemplate = (t: ResumeSettings['template']) => {
    if (t === r.template) return;
    const ready = built.current.get(`gen|${data.updatedAt}|${t}`);
    if (ready && !showingUpload) ready.then(show).catch(() => {});
    update({ template: t });
  };

  useEffect(() => {
    document.body.classList.add('no-scroll');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const update = (patch: Partial<ResumeSettings>) => {
    const d = ctx.latest();
    return ctx.save({ ...d, settings: { ...d.settings, resume: { ...d.settings.resume, ...patch } } }, 'Resume updated').catch(() => {});
  };

  const uploadPdf = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/resume/upload', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      ctx.setData(json);
      await update({ source: 'uploaded' });
    } catch (e) {
      ctx.notify((e as Error).message, 'error');
    } finally {
      setUploading(false);
      if (pdfInput.current) pdfInput.current.value = '';
    }
  };

  const removePdf = async () => {
    if (!confirm('Remove your uploaded PDF? Visitors will get the website resume instead.')) return;
    const res = await fetch('/api/resume/upload', { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      ctx.setData(json);
      ctx.notify('Uploaded PDF removed');
    } else ctx.notify(json.error || 'Could not remove', 'error');
  };

  const chooseSource = (source: ResumeSettings['source']) => {
    if (source === 'uploaded' && !r.uploadedName) return pdfInput.current?.click();
    if (source !== r.source) update({ source });
  };

  const pickAccent = (c: string) => {
    setAccent(c);
    clearTimeout(accentTimer.current);
    if (/^#[0-9a-f]{6}$/i.test(c)) accentTimer.current = setTimeout(() => update({ accent: c }), 350);
  };

  const ids = r.projectIds;
  const toggleProject = (id: string) => {
    if (ids.includes(id)) return update({ projectIds: ids.filter((x) => x !== id) });
    if (ids.length >= MAX_RESUME_PROJECTS) return ctx.notify(`Resume holds ${MAX_RESUME_PROJECTS} projects — untick one first.`, 'error');
    return update({ projectIds: [...ids, id] });
  };
  const moveProject = (id: string, dir: -1 | 1) => {
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    update({ projectIds: next });
  };
  const ordered = [...data.projects].sort((a, b) => {
    const ia = ids.indexOf(a.id);
    const ib = ids.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  return (
    <div className="overlay studio-overlay">
      <div className="modal studio" role="dialog" aria-modal="true" aria-label="Resume studio">
        <aside className="studio-side">
          <header className="studio-head">
            <div>
              <span className="eyebrow">Resume studio</span>
              <h3>Your one-click resume</h3>
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          </header>

          <div className="studio-group">
            <span className="label">When visitors click “Download resume” they get</span>
            <div className="source-grid" role="radiogroup">
              <button role="radio" aria-checked={r.source === 'generated'} className={`source ${r.source === 'generated' ? 'on' : ''}`} onClick={() => chooseSource('generated')}>
                <span className="source-dot" />
                <span>
                  <b>Website resume</b>
                  <small>Built from your portfolio with the settings below</small>
                </span>
              </button>
              <button role="radio" aria-checked={r.source === 'uploaded'} className={`source ${r.source === 'uploaded' ? 'on' : ''}`} onClick={() => chooseSource('uploaded')} disabled={uploading}>
                <span className="source-dot" />
                <span>
                  <b>My uploaded PDF</b>
                  <small>{uploading ? 'Uploading…' : r.uploadedName || 'Upload your own resume file'}</small>
                </span>
              </button>
            </div>
            <div className="row-gap">
              <button className="btn btn-sm" onClick={() => pdfInput.current?.click()} disabled={uploading}>
                <Icon name="upload" size={14} /> {r.uploadedName ? 'Replace PDF' : 'Upload PDF'}
              </button>
              {r.uploadedName && (
                <button className="btn btn-sm danger" onClick={removePdf}>
                  <Icon name="trash" size={14} /> Remove
                </button>
              )}
            </div>
            <input ref={pdfInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => e.target.files?.[0] && uploadPdf(e.target.files[0])} />
          </div>

          <div className={`studio-generated ${showingUpload ? 'muted-block' : ''}`}>
          {showingUpload && <p className="hint">These settings shape the website resume. Visitors currently get your uploaded PDF.</p>}
          <div className="studio-group">
            <span className="label">Template</span>
            <div className="tpl-grid">
              {(['creative', 'classic'] as const).map((t) => (
                <button key={t} className={`tpl ${r.template === t ? 'on' : ''}`} onClick={() => pickTemplate(t)}>
                  <span className={`tpl-thumb ${t}`} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>{t === 'creative' ? 'Creative' : 'Classic ATS'}</b>
                  <small>{t === 'creative' ? 'Two-column, modern' : 'Single column, like your original'}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="studio-group">
            <span className="label">Accent colour</span>
            <div className="swatches">
              {SWATCHES.map((c) => (
                <button key={c} className={`swatch ${accent === c ? 'on' : ''}`} style={{ background: c }} onClick={() => pickAccent(c)} aria-label={c} />
              ))}
              <label className="swatch custom" title="Custom colour">
                <input type="color" value={accent} onChange={(e) => pickAccent(e.target.value)} />
                <Icon name="plus" size={14} />
              </label>
            </div>
          </div>

          <div className="studio-group two">
            <label className="field">
              <span className="label">Paper</span>
              <select value={r.paper} onChange={(e) => update({ paper: e.target.value as ResumeSettings['paper'] })}>
                <option value="Letter">US Letter</option>
                <option value="A4">A4</option>
              </select>
            </label>
            <div className="toggles">
              <Toggle label="Fit on one page" on={r.fitOnePage} onChange={(v) => update({ fitOnePage: v })} />
              <Toggle label="Project links" on={r.showProjectLinks} onChange={(v) => update({ showProjectLinks: v })} />
              {r.template === 'creative' && (
                <Toggle label="Photo" on={r.showPhoto} disabled={!data.profile.photo} title={data.profile.photo ? '' : 'Upload a photo in Profile first'} onChange={(v) => update({ showPhoto: v })} />
              )}
            </div>
          </div>

          <div className="studio-group">
            <span className="label">
              Projects on the resume <em>{ids.length} / {MAX_RESUME_PROJECTS}</em>
            </span>
            <ul className="pick-list">
              {ordered.map((p) => {
                const pos = ids.indexOf(p.id);
                const on = pos > -1;
                return (
                  <li key={p.id} className={on ? 'on' : ''}>
                    <label>
                      <input type="checkbox" checked={on} onChange={() => toggleProject(p.id)} disabled={!on && ids.length >= MAX_RESUME_PROJECTS} />
                      <span className="pick-num">{on ? pos + 1 : ''}</span>
                      <span className="pick-name">
                        {p.name}
                        <small>{p.subtitle}</small>
                      </span>
                    </label>
                    {on && (
                      <span className="pick-move">
                        <button className="icon-btn sm" disabled={pos === 0} onClick={() => moveProject(p.id, -1)} aria-label="Move up">
                          <Icon name="up" size={14} />
                        </button>
                        <button className="icon-btn sm" disabled={pos === ids.length - 1} onClick={() => moveProject(p.id, 1)} aria-label="Move down">
                          <Icon name="down" size={14} />
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          </div>

          <div className="studio-status">
            {showingUpload ? (
              <span className="good">
                <Icon name="check" size={16} /> Visitors download your uploaded PDF
              </span>
            ) : loading ? (
              <span className="muted">Rendering…</span>
            ) : error ? (
              <span className="bad">{error}</span>
            ) : info ? (
              info.pages === 1 ? (
                <span className="good">
                  <Icon name="check" size={16} /> Exactly 1 page · text at {Math.round(info.scale * 100)}%
                </span>
              ) : (
                <span className="warn">
                  {info.pages} pages{r.fitOnePage ? ' — too much content to fit one page even at 78%. Trim a few bullets.' : ''}
                </span>
              )
            ) : null}
          </div>

          <div className="studio-actions">
            <a className="btn btn-primary" href={tu('/api/resume/download')} title="Exactly what visitors download">
              <Icon name="download" size={16} /> Download as visitor
            </a>
            {pdfUrl && (
              <a className="btn btn-ghost" href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Icon name="external" size={16} /> Open
              </a>
            )}
          </div>
        </aside>

        <div className="studio-preview">
          <PdfPreview bytes={bytes} />
          {showingUpload && <div className="studio-tag">Your uploaded PDF</div>}
          {!bytes && <div className="studio-empty">{error || 'Building your resume…'}</div>}
          {loading && pdfUrl && <div className="studio-loading">Updating…</div>}
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange, disabled, title }: { label: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; title?: string }) {
  return (
    <label className={`toggle ${disabled ? 'disabled' : ''}`} title={title}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
