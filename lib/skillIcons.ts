import 'server-only';
import * as si from 'simple-icons';

// Brand icons for skills, looked up on the server so the 3,000-icon library never reaches the browser.
// Anything without a brand logo (concepts like "Prompt Engineering") gets a generic icon on the client.

export type SkillIcon = { path: string; hex: string };

type SimpleIcon = { path: string; hex: string };
const icons = si as unknown as Record<string, SimpleIcon | undefined>;

// Common spellings → simple-icons slug.
const ALIASES: Record<string, string> = {
  java: 'openjdk',
  reactjs: 'react',
  react: 'react',
  nextjs: 'nextdotjs',
  next: 'nextdotjs',
  nodejs: 'nodedotjs',
  node: 'nodedotjs',
  vuejs: 'vuedotjs',
  vue: 'vuedotjs',
  expressjs: 'express',
  tailwind: 'tailwindcss',
  html: 'html5',
  css3: 'css',
  'c++': 'cplusplus',
  cpp: 'cplusplus',
  'c#': 'dotnet',
  csharp: 'dotnet',
  golang: 'go',
  postgres: 'postgresql',
  mongo: 'mongodb',
  springboot: 'springboot',
  jwt: 'jsonwebtokens',
  jwtauthentication: 'jsonwebtokens',
  githubrestapi: 'github',
  githubactions: 'githubactions',
  sklearn: 'scikitlearn',
  scikitlearn: 'scikitlearn',
  huggingface: 'huggingface',
  aws: 'amazonwebservices',
  gcp: 'googlecloud',
  k8s: 'kubernetes',
  swagger: 'swagger',
  openapi: 'openapiinitiative',
  jupyternotebook: 'jupyter',
};

// Brand names that might appear inside a longer skill, e.g. "LLM API Integration (OpenAI, DeepSeek)".
const EMBEDDED = ['deepseek', 'langchain', 'huggingface', 'tensorflow', 'pytorch', 'docker', 'kubernetes', 'github', 'mongodb', 'mysql', 'postgresql', 'redis', 'firebase', 'anthropic', 'ollama'];

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/\./g, 'dot')
    .replace(/[^a-z0-9]/g, '');

const lookup = (slug: string): SkillIcon | null => {
  const icon = icons['si' + slug.charAt(0).toUpperCase() + slug.slice(1)];
  return icon ? { path: icon.path, hex: `#${icon.hex}` } : null;
};

export function skillIcon(name: string): SkillIcon | null {
  const raw = name.trim().toLowerCase();
  const compact = raw.replace(/[^a-z0-9+#]/g, '');
  const alias = ALIASES[raw] ?? ALIASES[compact] ?? ALIASES[compact.replace(/js$/, '')];
  if (alias) return lookup(alias);
  const direct = lookup(toSlug(raw)) ?? lookup(toSlug(raw.replace(/\s*\(.*\)$/, '')));
  if (direct) return direct;
  const inside = EMBEDDED.find((b) => compact.includes(b));
  return inside ? lookup(inside) : null;
}

/** Icons for a list of skill names (null = no brand logo; the client shows a generic icon). */
export function skillIcons(names: string[]): Record<string, SkillIcon | null> {
  const out: Record<string, SkillIcon | null> = {};
  for (const n of names) if (n && !(n in out)) out[n] = skillIcon(n);
  return out;
}
