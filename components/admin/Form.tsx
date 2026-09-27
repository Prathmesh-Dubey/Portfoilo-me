'use client';

import { useEffect, useRef, useState } from 'react';
import { useBackClose } from '../backClose';
import { Icon } from '../Icons';
import { PasswordInput } from '../PasswordInput';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>;

export type Field =
  | { type: 'text' | 'email' | 'url' | 'color'; key: string; label: string; hint?: string; placeholder?: string; half?: boolean }
  | { type: 'textarea'; key: string; label: string; hint?: string; placeholder?: string; rows?: number }
  | { type: 'lines'; key: string; label: string; hint?: string; placeholder?: string; rows?: number }
  | { type: 'checkbox'; key: string; label: string; hint?: string; half?: boolean }
  | { type: 'password'; key: string; label: string; hint?: string; half?: boolean; autoComplete?: string }
  | { type: 'select'; key: string; label: string; options: { value: string; label: string }[]; hint?: string; half?: boolean }
  | { type: 'images'; key: string; label: string; hint?: string }
  | { type: 'repeater'; key: string; label: string; hint?: string; fields: Field[]; newItem: () => Obj; itemTitle: (item: Obj, i: number) => string; addLabel?: string }
  | { type: 'custom'; key: string; render: () => React.ReactNode };

export type EditorSpec = {
  title: string;
  description?: string;
  fields: Field[];
  value: Obj;
  onSave: (value: Obj) => Promise<unknown>;
  submitLabel?: string;
  danger?: { label: string; onClick: () => Promise<unknown> };
};

// ---------- modal ----------

export function EditorModal({ spec, onClose }: { spec: EditorSpec; onClose: () => void }) {
  const [value, setValue] = useState<Obj>(spec.value);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const close = () => {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    onClose();
  };

  useBackClose(true, close);

  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await spec.onSave(value);
      onClose();
    } catch {
      /* error already toasted */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()} onKeyDown={(e) => e.key === 'Escape' && close()}>
      <form className="modal editor" onSubmit={submit} role="dialog" aria-modal="true" aria-label={spec.title}>
        <header className="editor-head">
          <div>
            <h3>{spec.title}</h3>
            {spec.description && <p>{spec.description}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="editor-body">
          <Fields
            fields={spec.fields}
            value={value}
            onChange={(v) => {
              setValue(v);
              setDirty(true);
            }}
          />
        </div>
        <footer className="editor-foot">
          {spec.danger && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await spec.danger!.onClick();
                  onClose();
                } catch {
                  /* toasted */
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Icon name="trash" size={16} /> {spec.danger.label}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : spec.submitLabel ?? 'Save changes'}
          </button>
        </footer>
      </form>
    </div>
  );
}

// ---------- fields ----------

export function Fields({ fields, value, onChange }: { fields: Field[]; value: Obj; onChange: (v: Obj) => void }) {
  const set = (key: string, v: any) => onChange({ ...value, [key]: v });
  return (
    <div className="fields">
      {fields.map((f) => (
        <FieldView key={f.key} field={f} value={value[f.key]} onChange={(v) => set(f.key, v)} />
      ))}
    </div>
  );
}

function FieldView({ field: f, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  if (f.type === 'custom') return <div className="field full">{f.render()}</div>;

  const hint = 'hint' in f && f.hint ? <small className="hint">{f.hint}</small> : null;
  const half = 'half' in f && f.half ? 'half' : 'full';

  switch (f.type) {
    case 'text':
    case 'email':
    case 'url':
      return (
        <label className={`field ${half}`}>
          <span className="label">{f.label}</span>
          <input type={f.type === 'url' ? 'text' : f.type} value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
          {hint}
        </label>
      );
    case 'color':
      return (
        <label className={`field ${half}`}>
          <span className="label">{f.label}</span>
          <span className="color-row">
            <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} />
            <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} maxLength={7} />
          </span>
          {hint}
        </label>
      );
    case 'textarea':
      return (
        <label className="field full">
          <span className="label">{f.label}</span>
          <textarea rows={f.rows ?? 4} value={value ?? ''} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
          {hint}
        </label>
      );
    case 'lines':
      // One item per line; the array round-trips exactly, empty lines are dropped on save.
      return (
        <label className="field full">
          <span className="label">
            {f.label} <em>one per line</em>
          </span>
          <textarea rows={f.rows ?? 4} value={(value ?? []).join('\n')} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value.split('\n'))} />
          {hint}
        </label>
      );
    case 'password':
      return (
        <label className={`field ${half}`}>
          <span className="label">{f.label}</span>
          <PasswordInput value={value ?? ''} autoComplete={f.autoComplete} onChange={(e) => onChange(e.target.value)} />
          {hint}
        </label>
      );
    case 'checkbox':
      return (
        <label className={`field check ${half}`}>
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          <span>
            <span className="label">{f.label}</span>
            {hint}
          </span>
        </label>
      );
    case 'select':
      return (
        <label className={`field ${half}`}>
          <span className="label">{f.label}</span>
          <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {hint}
        </label>
      );
    case 'images':
      return <ImagesField label={f.label} hint={hint} value={value ?? []} onChange={onChange} />;
    case 'repeater':
      return <Repeater field={f} value={value ?? []} onChange={onChange} hint={hint} />;
  }
}

function Repeater({ field: f, value, onChange, hint }: { field: Extract<Field, { type: 'repeater' }>; value: Obj[]; onChange: (v: Obj[]) => void; hint: React.ReactNode }) {
  const [open, setOpen] = useState<number | null>(value.length === 1 ? 0 : null);
  const update = (i: number, item: Obj) => onChange(value.map((x, j) => (j === i ? item : x)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen(open === i ? j : open === j ? i : open);
  };

  return (
    <div className="field full">
      <span className="label">{f.label}</span>
      {hint}
      <div className="repeater">
        {value.map((item, i) => (
          <div key={i} className={`rep-item ${open === i ? 'open' : ''}`}>
            <div className="rep-head">
              <button type="button" className="rep-title" onClick={() => setOpen(open === i ? null : i)}>
                <span className="rep-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="rep-name">{f.itemTitle(item, i) || 'Untitled'}</span>
              </button>
              <button type="button" className="icon-btn sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                <Icon name="up" size={15} />
              </button>
              <button type="button" className="icon-btn sm" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move down">
                <Icon name="down" size={15} />
              </button>
              <button
                type="button"
                className="icon-btn sm danger"
                onClick={() => {
                  if (confirm(`Remove "${f.itemTitle(item, i) || 'this item'}"?`)) {
                    onChange(value.filter((_, j) => j !== i));
                    setOpen(null);
                  }
                }}
                aria-label="Remove"
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
            {open === i && (
              <div className="rep-body">
                <Fields fields={f.fields} value={item} onChange={(v) => update(i, v)} />
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          className="btn btn-dashed"
          onClick={() => {
            onChange([...value, f.newItem()]);
            setOpen(value.length);
          }}
        >
          <Icon name="plus" size={16} /> {f.addLabel ?? 'Add item'}
        </button>
      </div>
    </div>
  );
}

function ImagesField({ label, hint, value, onChange }: { label: string; hint: React.ReactNode; value: string[]; onChange: (v: string[]) => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const add = () => {
    const u = url.trim();
    if (!/^https?:\/\/\S+$/i.test(u)) return setErr('Paste a full image URL starting with https://');
    onChange([...value, u]);
    setUrl('');
    setErr('');
  };

  const upload = async (files: FileList) => {
    setBusy(true);
    setErr('');
    const added: string[] = [];
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/uploads', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (res.ok) added.push(json.url);
      else setErr(`${file.name}: ${json.error || 'upload failed'}`);
    }
    if (added.length) onChange([...value, ...added]);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <div className="field full">
      <span className="label">{label}</span>
      {hint}
      <div className="img-list">
        {value.map((src, i) => (
          <div key={src + i} className="img-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" />
            <div className="img-actions">
              {i > 0 && (
                <button type="button" className="icon-btn sm" title="Make cover (move first)" onClick={() => onChange([src, ...value.filter((_, j) => j !== i)])}>
                  <Icon name="star" size={14} />
                </button>
              )}
              <button type="button" className="icon-btn sm danger" title="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <Icon name="trash" size={14} />
              </button>
            </div>
            {i === 0 && <span className="img-badge">Cover</span>}
          </div>
        ))}
      </div>
      <div className="inline-add">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => fileInput.current?.click()}>
          <Icon name="upload" size={16} /> {busy ? 'Uploading…' : 'Upload'}
        </button>
        <input
          type="text"
          placeholder="…or paste an image URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn-ghost" onClick={add}>
          <Icon name="plus" size={16} /> Add
        </button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => e.target.files?.length && upload(e.target.files)} />
      </div>
      {err && <small className="form-error">{err}</small>}
    </div>
  );
}
