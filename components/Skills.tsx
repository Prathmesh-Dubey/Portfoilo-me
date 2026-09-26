'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Project, SkillGroup } from '@/lib/types';
import { Icon, type IconName } from './Icons';

export type SkillIconMap = Record<string, { path: string; hex: string } | null>;

/** Loose comparison key so "React.js" matches "React" and "Node.js" matches "Node". */
export const skillKey = (s: string) => s.toLowerCase().replace(/\.?js$/, '').replace(/[^a-z0-9+#]/g, '');

/** Projects whose tech stack uses any skill in the group. */
export function projectsUsing(items: string[], projects: Project[]) {
  const keys = new Set(items.map(skillKey));
  return projects.filter((p) => p.tech.some((t) => keys.has(skillKey(t))));
}

function genericIcon(name: string): IconName {
  const s = name.toLowerCase();
  if (/oauth|auth|jwt|secur/.test(s)) return 'shield';
  if (/rag|retriev|search|embedding/.test(s)) return 'search';
  if (/sql|database|schema|query|vector/.test(s)) return 'database';
  if (/webhook|api|rest|grpc/.test(s)) return 'plug';
  if (/prompt|chat/.test(s)) return 'chat';
  if (/valid|test/.test(s)) return 'check';
  if (/agent|llm|\bai\b|nlp|machine|model|neural/.test(s)) return 'brain';
  if (/algorithm|structure|oop|system design|architecture/.test(s)) return 'nodes';
  if (/agile|scrum|kanban/.test(s)) return 'cycle';
  if (/cloud|aws|azure|deploy/.test(s)) return 'cloud';
  if (/code|editor|ide|studio/.test(s)) return 'codeWindow';
  return 'code';
}

function categoryIcon(category: string): IconName {
  const s = category.toLowerCase();
  if (/lang/.test(s)) return 'codeWindow';
  if (/ai|ml|machine|intelligence|data sci/.test(s)) return 'brain';
  if (/back|server/.test(s)) return 'server';
  if (/front|ui|web/.test(s)) return 'layout';
  if (/data|db|storage/.test(s)) return 'database';
  if (/cloud|devops/.test(s)) return 'cloud';
  if (/tool|concept/.test(s)) return 'wrench';
  return 'sparkle';
}

/** Very dark brand colours (Next.js, GitHub…) follow the text colour so they stay visible in dark mode. */
function brandFill(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.22 ? 'currentColor' : hex;
}

function SkillChip({ name, icon }: { name: string; icon: SkillIconMap[string] | undefined }) {
  return (
    <span className="chip skill-chip">
      {icon ? (
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
          <path d={icon.path} fill={brandFill(icon.hex)} />
        </svg>
      ) : (
        <Icon name={genericIcon(name)} size={15} className="skill-generic" />
      )}
      {name}
    </span>
  );
}

function Waves() {
  return (
    <svg className="skill-waves" viewBox="0 0 300 160" preserveAspectRatio="none" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M0 ${130 - i * 6} C 80 ${70 - i * 10}, 170 ${170 - i * 8}, 300 ${60 - i * 9}`} fill="none" stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  );
}

export function SkillsGrid({
  groups,
  projects,
  initialIcons,
  onViewProjects,
}: {
  groups: SkillGroup[];
  projects: Project[];
  initialIcons: SkillIconMap;
  onViewProjects: (group: SkillGroup) => void;
}) {
  const [icons, setIcons] = useState<SkillIconMap>(initialIcons);

  // Newly added skills (admin edits) fetch their icons without a page reload.
  const missing = useMemo(() => [...new Set(groups.flatMap((g) => g.items))].filter((n) => !(n in icons)), [groups, icons]);
  useEffect(() => {
    if (!missing.length) return;
    const qs = missing.map((n) => `n=${encodeURIComponent(n)}`).join('&');
    fetch(`/api/skill-icons?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((more) => more && setIcons((cur) => ({ ...cur, ...more })))
      .catch(() => {});
  }, [missing]);

  return (
    <div className="skills-grid">
      {groups.map((g, i) => {
        const count = projectsUsing(g.items, projects).length;
        const cat = categoryIcon(g.category);
        return (
          <article key={i} className="skill-card reveal" style={{ '--d': `${i * 60}ms` } as React.CSSProperties}>
            <Waves />
            <Icon name={cat} size={40} strokeWidth={1.2} className="skill-art" />
            <h3>
              <Icon name={cat} size={18} className="skill-head-icon" />
              {g.category}
            </h3>
            <div className="chips">
              {g.items.map((s) => (
                <SkillChip key={s} name={s} icon={icons[s]} />
              ))}
            </div>
            {count > 0 && (
              <button className="skill-link" onClick={() => onViewProjects(g)}>
                View Projects <Icon name="chevron" size={14} />
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
