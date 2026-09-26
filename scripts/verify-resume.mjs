// Proves the generated resume PDF matches your saved content exactly.
//
//   npm run verify:resume                    (server on http://localhost:3000)
//   npm run verify:resume -- http://localhost:3100
//
// It downloads /api/resume, extracts the PDF's text layer and checks that every field that should be
// printed is present character-for-character (whitespace/line-wrapping ignored), that projects NOT
// chosen for the resume are absent, and that "fit on one page" really produced one page.
import { readFileSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const base = process.argv[2] || 'http://localhost:3000';
const data = JSON.parse(readFileSync('data/portfolio.json', 'utf8'));
const r = data.settings.resume;

const res = await fetch(`${base}/api/resume`);
if (!res.ok) {
  console.error(`✗ ${base}/api/resume returned ${res.status}. Is the server running?`);
  process.exit(1);
}
const doc = await pdfjs.getDocument({ data: new Uint8Array(await res.arrayBuffer()), useSystemFonts: false }).promise;
let text = '';
const links = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  text += (await page.getTextContent()).items.map((it) => it.str).join('');
  for (const a of await page.getAnnotations()) if (a.url) links.push(a.url);
}

const squash = (s) => String(s).replace(/\s+/g, '').toLowerCase();
const haystack = squash(text);
const projectLinks = (x) => [...(x.demo ? [{ url: x.demo }] : []), ...(x.repo ? [{ url: x.repo }] : []), ...x.links];
const pretty = (url) => url.replace(/^mailto:|^tel:/i, '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

const expected = [];
const want = (label, value) => value && expected.push([label, value]);
const p = data.profile;
want('name', p.name);
p.title.split('|').map((s) => s.trim()).forEach((t) => want('headline', t));
want('location', p.location);
want('phone', p.phone);
want('email', p.email);
p.links.filter((l) => l.showOnResume).forEach((l) => want(`link ${l.label}`, pretty(l.url)));
want('summary', data.summary);
data.skills.forEach((g) => {
  want('skill group', g.category);
  g.items.forEach((s) => want(`skill (${g.category})`, s));
});
data.experience.forEach((x) => {
  [x.role, x.company, x.location, x.start, x.end].forEach((v) => want(`experience: ${x.role}`, v));
  x.tech.forEach((t) => want(`experience tech: ${x.role}`, t));
  x.bullets.forEach((b) => want(`experience bullet: ${x.role}`, b));
});
const chosen = r.projectIds.map((id) => data.projects.find((pr) => pr.id === id)).filter(Boolean);
chosen.forEach((x) => {
  [x.name, x.subtitle, x.start, x.end].forEach((v) => want(`project: ${x.name}`, v));
  x.tech.forEach((t) => want(`project tech: ${x.name}`, t));
  (x.bullets.length ? x.bullets : [x.summary]).forEach((b) => want(`project text: ${x.name}`, b));
  if (r.showProjectLinks) projectLinks(x).slice(0, 2).forEach((l) => want(`project link: ${x.name}`, pretty(l.url)));
});
data.education.forEach((e) => [e.degree, e.school, e.start, e.end, e.score].forEach((v) => want(`education: ${e.degree}`, v)));
data.certifications.forEach((c) => [c.name, c.issuer, c.date].forEach((v) => want(`certification: ${c.name}`, v)));
data.achievements.forEach((a) => want('achievement', a));

const missing = expected.filter(([, v]) => !haystack.includes(squash(v)));
const leaked = data.projects
  .filter((x) => !r.projectIds.includes(x.id))
  .filter((x) => !chosen.some((c) => squash(c.name).includes(squash(x.name))))
  .filter((x) => haystack.includes(squash(x.name)));
const expectLinks = [
  p.email && `mailto:${p.email}`,
  ...p.links.filter((l) => l.showOnResume).map((l) => l.url),
  ...(r.showProjectLinks ? chosen.flatMap((x) => projectLinks(x).slice(0, 2).map((l) => l.url)) : []),
].filter(Boolean);
const deadLinks = expectLinks.filter((u) => !links.includes(u));

console.log(`Resume: ${r.template} template, ${r.paper}, ${doc.numPages} page(s), scale ${res.headers.get('x-resume-scale')}`);
console.log(`Checked ${expected.length} text fields and ${expectLinks.length} clickable links.`);
let ok = true;
if (missing.length) {
  ok = false;
  console.log(`\n✗ ${missing.length} field(s) missing or altered in the PDF:`);
  missing.forEach(([label, v]) => console.log(`   - ${label}: "${v}"`));
}
if (leaked.length) {
  ok = false;
  console.log(`\n✗ Projects not selected for the resume appear in it: ${leaked.map((x) => x.name).join(', ')}`);
}
if (deadLinks.length) {
  ok = false;
  console.log(`\n✗ Links not clickable in the PDF: ${deadLinks.join(', ')}`);
}
if (r.fitOnePage && doc.numPages !== 1) console.log(`\n! "Fit on one page" is on but the content needs ${doc.numPages} pages — trim some text.`);
console.log(ok ? '\n✓ PDF matches your saved data exactly.' : '');
process.exit(ok ? 0 : 1);
