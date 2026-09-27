import { Document, Page, View, Text, Link, StyleSheet } from '@react-pdf/renderer';
import { projectLinks } from '../links';
import { PAGE_SIZE, Icon, iconFor, pretty, range, selectedProjects, shade, telHref, tint, type DocProps } from './shared';

// "Timeline": single column with the dates in a narrow left column and a dotted line running down the page,
// so a recruiter can follow the career in order at a glance. Everything is sized from `k` for the auto-fit.
// Page padding: 30 top / 28 bottom (see PADDING in render.tsx).

const INK = '#0f172a';
const BODY = '#334155';
const MUTED = '#64748b';

function styles(accent: string, k: number) {
  const deep = shade(accent, 0.15);
  const line = tint(accent, 0.7);
  return StyleSheet.create({
    page: { fontFamily: 'Inter', fontSize: 8.6 * k, color: BODY, paddingTop: 30, paddingBottom: 28, paddingHorizontal: 40, lineHeight: 1.36 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    name: { fontFamily: 'Sora', fontWeight: 700, fontSize: 26 * k, color: INK, letterSpacing: -0.5, lineHeight: 1.08 },
    role: { fontWeight: 600, fontSize: 9.4 * k, color: accent, marginTop: 3 * k, letterSpacing: 0.2 },
    contact: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '46%' },
    contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 * k },
    contactText: { fontSize: 7.6 * k, color: BODY, textDecoration: 'none', marginLeft: 4 * k },
    headRule: { height: 1.4, backgroundColor: accent, marginTop: 9 * k },
    headRuleSoft: { height: 0.6, backgroundColor: line, marginTop: 2 },
    section: { marginTop: 9 * k },
    h2Row: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 * k },
    h2Mark: { width: 4 * k, height: 11 * k, borderRadius: 1, backgroundColor: accent, marginRight: 7 * k },
    h2: { fontFamily: 'Sora', fontWeight: 700, fontSize: 9.4 * k, color: INK, letterSpacing: 1.4, textTransform: 'uppercase' },
    summary: { fontSize: 8.6 * k, color: BODY, lineHeight: 1.45, paddingLeft: 11 * k },
    // timeline rows: [date column][gutter with dot + line][content]
    row: { flexDirection: 'row' },
    dateCol: { width: 78 * k, paddingRight: 6 * k, paddingTop: 1.2 * k },
    dateText: { fontWeight: 600, fontSize: 7.2 * k, color: deep, textAlign: 'right', lineHeight: 1.3 },
    gutter: { width: 14 * k, alignItems: 'center' },
    dot: { width: 6 * k, height: 6 * k, borderRadius: 3 * k, backgroundColor: accent, marginTop: 3 * k, borderWidth: 1.2, borderColor: '#ffffff' },
    vline: { flex: 1, width: 1, backgroundColor: line, marginTop: 1 },
    content: { flex: 1, paddingLeft: 6 * k, paddingBottom: 7 * k },
    h3: { fontWeight: 700, fontSize: 9.2 * k, color: INK },
    at: { fontWeight: 500, color: deep },
    meta: { fontSize: 7.8 * k, color: MUTED },
    tech: { fontStyle: 'italic', fontSize: 7.8 * k, color: MUTED, marginTop: 1.2 * k, marginBottom: 1.4 * k },
    plinks: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 1.4 * k },
    plink: { flexDirection: 'row', alignItems: 'center', marginRight: 9 * k },
    plinkText: { fontSize: 7.6 * k, color: deep, textDecoration: 'none', marginLeft: 3 * k },
    bullet: { flexDirection: 'row', marginTop: 1.5 * k },
    bulletMark: { width: 8 * k, color: accent, fontWeight: 700 },
    bulletText: { flex: 1, fontSize: 8.4 * k, color: BODY },
    // skills / achievements use the same left column for the label
    label: { fontWeight: 700, fontSize: 7.6 * k, color: INK, textAlign: 'right', letterSpacing: 0.3, lineHeight: 1.3 },
    plain: { flex: 1, paddingLeft: 6 * k, paddingBottom: 3.5 * k, fontSize: 8.4 * k, color: BODY },
    score: { fontWeight: 600, color: INK },
  });
}

export function TimelineResume({ data: d, scale: k }: DocProps) {
  const r = d.settings.resume;
  const s = styles(r.accent, k);
  const p = d.profile;
  const roles = p.title.split('|').map((t) => t.trim()).filter(Boolean);
  const projects = selectedProjects(d);

  const contact: { icon: Parameters<typeof Icon>[0]['name']; text: string; href?: string }[] = [
    ...(p.email ? [{ icon: 'mail' as const, text: p.email, href: `mailto:${p.email}` }] : []),
    ...(p.phone ? [{ icon: 'phone' as const, text: p.phone, href: telHref(p.phone) }] : []),
    ...(p.location ? [{ icon: 'pin' as const, text: p.location }] : []),
    ...p.links.filter((l) => l.showOnResume).map((l) => ({ icon: iconFor(l), text: pretty(l.url), href: l.url })),
  ];

  return (
    <Document title={`${p.name} — Resume`} author={p.name} subject={p.title} creator={p.name} producer={p.name}>
      <Page size={PAGE_SIZE[r.paper]} style={s.page}>
        <View style={s.head}>
          <View style={{ flexShrink: 1, paddingRight: 12 }}>
            <Text style={s.name}>{p.name}</Text>
            {roles.length > 0 && <Text style={s.role}>{roles.join('  ·  ')}</Text>}
          </View>
          <View style={s.contact}>
            {contact.map((c, i) => (
              <View key={i} style={s.contactRow}>
                <Icon name={c.icon} size={7.6 * k} color={r.accent} />
                {c.href ? (
                  <Link src={c.href} style={s.contactText}>
                    {c.text}
                  </Link>
                ) : (
                  <Text style={s.contactText}>{c.text}</Text>
                )}
              </View>
            ))}
          </View>
        </View>
        <View style={s.headRule} />
        <View style={s.headRuleSoft} />

        {d.summary !== '' && (
          <Section s={s} title="Profile">
            <Text style={s.summary}>{d.summary}</Text>
          </Section>
        )}

        {d.experience.length > 0 && (
          <Section s={s} title="Experience">
            {d.experience.map((x, i) => (
              <Row key={x.id} s={s} date={range(x.start, x.end, ' –\n')} last={i === d.experience.length - 1}>
                <Text style={s.h3}>
                  {x.role}
                  {x.company !== '' && <Text style={s.at}>{`  ·  ${x.company}`}</Text>}
                </Text>
                {x.location !== '' && <Text style={s.meta}>{x.location}</Text>}
                {x.tech.length > 0 && <Text style={s.tech}>{x.tech.join('  ·  ')}</Text>}
                <Bullets s={s} items={x.bullets} />
              </Row>
            ))}
          </Section>
        )}

        {projects.length > 0 && (
          <Section s={s} title="Projects">
            {projects.map((x, i) => {
              const links = r.showProjectLinks ? projectLinks(x).slice(0, 2) : [];
              return (
                <Row key={x.id} s={s} date={range(x.start, x.end, ' –\n')} last={i === projects.length - 1}>
                  <Text style={s.h3}>
                    {x.name}
                    {x.subtitle !== '' && <Text style={s.at}>{`  ·  ${x.subtitle}`}</Text>}
                  </Text>
                  {x.tech.length > 0 && <Text style={s.tech}>{x.tech.join('  ·  ')}</Text>}
                  {links.length > 0 && (
                    <View style={s.plinks}>
                      {links.map((l, j) => (
                        <View key={j} style={s.plink}>
                          <Icon name={iconFor(l)} size={7.4 * k} color={r.accent} />
                          <Link src={l.url} style={s.plinkText}>
                            {pretty(l.url)}
                          </Link>
                        </View>
                      ))}
                    </View>
                  )}
                  {x.bullets.length > 0 ? <Bullets s={s} items={x.bullets} /> : x.summary !== '' && <Text style={s.bulletText}>{x.summary}</Text>}
                </Row>
              );
            })}
          </Section>
        )}

        {d.skills.length > 0 && (
          <Section s={s} title="Skills">
            {d.skills.map((g, i) => (
              <View key={i} style={s.row} wrap={false}>
                <View style={s.dateCol}>
                  <Text style={s.label}>{g.category}</Text>
                </View>
                <View style={s.gutter} />
                <Text style={s.plain}>{g.items.join('  ·  ')}</Text>
              </View>
            ))}
          </Section>
        )}

        {d.education.length > 0 && (
          <Section s={s} title="Education">
            {d.education.map((e, i) => (
              <Row key={e.id} s={s} date={range(e.start, e.end, ' –\n')} last={i === d.education.length - 1}>
                <Text style={s.h3}>{e.degree}</Text>
                {(e.school || e.score) !== '' && (
                  <Text style={s.meta}>
                    {e.school}
                    {e.school && e.score ? '  ·  ' : ''}
                    {e.score !== '' && <Text style={s.score}>{e.score}</Text>}
                  </Text>
                )}
              </Row>
            ))}
          </Section>
        )}

        {d.certifications.length > 0 && (
          <Section s={s} title="Certifications">
            {d.certifications.map((c, i) => (
              <Row key={c.id} s={s} date={c.date} last={i === d.certifications.length - 1}>
                {c.url ? (
                  <Link src={c.url} style={[s.h3, { textDecoration: 'none' }]}>
                    {c.name || c.course}
                  </Link>
                ) : (
                  <Text style={s.h3}>{c.name || c.course}</Text>
                )}
                {[c.name ? c.course : '', c.issuer].filter(Boolean).length > 0 && <Text style={s.meta}>{[c.name ? c.course : '', c.issuer].filter(Boolean).join('  ·  ')}</Text>}
              </Row>
            ))}
          </Section>
        )}

        {d.achievements.length > 0 && (
          <Section s={s} title="Achievements">
            <View style={s.row}>
              <View style={s.dateCol} />
              <View style={s.gutter} />
              <View style={{ flex: 1, paddingLeft: 6 * k }}>
                <Bullets s={s} items={d.achievements} />
              </View>
            </View>
          </Section>
        )}
      </Page>
    </Document>
  );
}

// ---------- building blocks ----------

type S = ReturnType<typeof styles>;

function Section({ s, title, children }: { s: S; title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.h2Row} minPresenceAhead={40}>
        <View style={s.h2Mark} />
        <Text style={s.h2}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/** One timeline entry: the date on the left, a dot on the line, the content on the right. */
function Row({ s, date, last, children }: { s: S; date: string; last: boolean; children: React.ReactNode }) {
  return (
    <View style={s.row} wrap={false}>
      <View style={s.dateCol}>{date !== '' && <Text style={s.dateText}>{date}</Text>}</View>
      <View style={s.gutter}>
        <View style={s.dot} />
        {!last && <View style={s.vline} />}
      </View>
      <View style={s.content}>{children}</View>
    </View>
  );
}

function Bullets({ s, items }: { s: S; items: string[] }) {
  return (
    <>
      {items.map((b, i) => (
        <View key={i} style={s.bullet}>
          <Text style={s.bulletMark}>–</Text>
          <Text style={s.bulletText}>{b}</Text>
        </View>
      ))}
    </>
  );
}
