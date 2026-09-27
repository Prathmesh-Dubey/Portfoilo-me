import { Document, Page, View, Text, Link, Image, StyleSheet } from '@react-pdf/renderer';
import { projectLinks } from '../links';
import { PAGE_SIZE, Icon, iconFor, pretty, range, selectedProjects, shade, telHref, tint, type DocProps } from './shared';

// "Modern": a full-height sidebar in the accent colour (contact, skills, education, extras) beside a white main
// column (name, profile, experience, projects). Everything is sized from `k` so the auto-fit can scale it.
// The page itself has no padding; the columns carry it (main: 28 top / 26 bottom — see PADDING in render.tsx).

const INK = '#0f172a';
const BODY = '#334155';
const MUTED = '#64748b';

function styles(accent: string, k: number) {
  const side = shade(accent, 0.3);
  const sideDeep = shade(accent, 0.45);
  const sideLine = tint(accent, 0.25);
  const onSide = '#ffffff';
  const onSideSoft = tint(accent, 0.8);
  const soft = tint(accent, 0.92);
  return StyleSheet.create({
    page: { fontFamily: 'Inter', fontSize: 8.6 * k, color: BODY, lineHeight: 1.36, flexDirection: 'row' },
    // sidebar
    aside: { width: '32%', height: '100%', backgroundColor: side, color: onSide, paddingTop: 28, paddingBottom: 26, paddingHorizontal: 13 * k },
    photo: { width: 64 * k, height: 64 * k, borderRadius: 32 * k, objectFit: 'cover', alignSelf: 'center', marginBottom: 10 * k, borderWidth: 2, borderColor: onSideSoft },
    sideSection: { marginTop: 11 * k },
    sideH2: { fontFamily: 'Sora', fontWeight: 700, fontSize: 8.4 * k, color: onSide, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5 * k, paddingBottom: 3 * k, borderBottomWidth: 0.8, borderBottomColor: sideLine },
    contactRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3.4 * k },
    contactIcon: { width: 11 * k, marginRight: 5 * k, paddingTop: 1.2 * k },
    contactText: { flex: 1, fontSize: 7.6 * k, color: onSide, textDecoration: 'none', lineHeight: 1.35 },
    // long addresses (LinkedIn URLs, long emails) can't wrap mid-word, so they get a smaller size to fit the column
    contactLong: { fontSize: 6.2 * k },
    skill: { marginBottom: 5 * k },
    h4: { fontWeight: 700, fontSize: 7.3 * k, color: onSideSoft, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2.4 * k },
    chips: { flexDirection: 'row', flexWrap: 'wrap' },
    chip: { fontWeight: 500, fontSize: 7.2 * k, color: onSide, backgroundColor: sideDeep, borderRadius: 3 * k, paddingVertical: 1.4 * k, paddingHorizontal: 4.2 * k, marginRight: 2.6 * k, marginBottom: 2.6 * k, lineHeight: 1.25 },
    edu: { marginBottom: 6 * k },
    degree: { fontWeight: 700, fontSize: 8 * k, color: onSide, lineHeight: 1.3 },
    school: { fontSize: 7.4 * k, color: onSideSoft, marginTop: 1 * k, lineHeight: 1.3 },
    eduMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 1.6 * k },
    eduDate: { fontWeight: 600, fontSize: 7.3 * k, color: onSideSoft },
    score: { fontWeight: 600, fontSize: 7.3 * k, color: onSide },
    sideBullet: { flexDirection: 'row', marginTop: 1.6 * k },
    sideDot: { width: 3 * k, height: 3 * k, borderRadius: 1.5 * k, backgroundColor: onSideSoft, marginTop: 3.6 * k, marginRight: 5 * k },
    sideText: { flex: 1, fontSize: 7.6 * k, color: onSide, lineHeight: 1.35 },
    // main column
    main: { width: '68%', paddingTop: 28, paddingBottom: 26, paddingHorizontal: 22 },
    name: { fontFamily: 'Sora', fontWeight: 700, fontSize: 26 * k, color: INK, letterSpacing: -0.5, lineHeight: 1.08 },
    role: { fontWeight: 600, fontSize: 9.6 * k, color: accent, marginTop: 4 * k, letterSpacing: 0.2 },
    bar: { width: 34 * k, height: 3 * k, borderRadius: 1.5 * k, backgroundColor: accent, marginTop: 8 * k },
    section: { marginTop: 10 * k },
    h2: { fontFamily: 'Sora', fontWeight: 700, fontSize: 9.4 * k, color: INK, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 5 * k, paddingBottom: 3 * k, borderBottomWidth: 1, borderBottomColor: tint(accent, 0.6) },
    summary: { fontSize: 8.6 * k, color: BODY, lineHeight: 1.45 },
    entry: { marginBottom: 7 * k },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    h3: { fontWeight: 700, fontSize: 9.2 * k, color: INK, flex: 1, paddingRight: 8 },
    at: { fontWeight: 500, color: accent },
    date: { marginLeft: 4, fontWeight: 600, fontSize: 7.4 * k, color: shade(accent, 0.15), backgroundColor: soft, paddingVertical: 1.4 * k, paddingHorizontal: 5 * k, borderRadius: 7 * k, flexShrink: 0 },
    meta: { fontSize: 7.8 * k, color: MUTED },
    tech: { fontStyle: 'italic', fontSize: 7.8 * k, color: MUTED, marginTop: 1.2 * k, marginBottom: 1.6 * k },
    plinks: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 1.6 * k },
    plink: { flexDirection: 'row', alignItems: 'center', marginRight: 9 * k },
    plinkText: { fontSize: 7.6 * k, color: shade(accent, 0.15), textDecoration: 'none', marginLeft: 3 * k },
    bullet: { flexDirection: 'row', marginTop: 1.6 * k },
    dotWrap: { width: 9 * k, paddingTop: 3.3 * k },
    dot: { width: 3.2 * k, height: 3.2 * k, borderRadius: 1.6 * k, backgroundColor: accent },
    bulletText: { flex: 1, fontSize: 8.4 * k, color: BODY },
  });
}

export function ModernResume({ data: d, scale: k, photo }: DocProps) {
  const r = d.settings.resume;
  const s = styles(r.accent, k);
  const p = d.profile;
  const roles = p.title.split('|').map((t) => t.trim()).filter(Boolean);
  const projects = selectedProjects(d);

  const contact: { icon: Parameters<typeof Icon>[0]['name']; text: string; href?: string }[] = [
    ...(p.location ? [{ icon: 'pin' as const, text: p.location }] : []),
    ...(p.phone ? [{ icon: 'phone' as const, text: p.phone, href: telHref(p.phone) }] : []),
    ...(p.email ? [{ icon: 'mail' as const, text: p.email, href: `mailto:${p.email}` }] : []),
    ...p.links.filter((l) => l.showOnResume).map((l) => ({ icon: iconFor(l), text: pretty(l.url), href: l.url })),
  ];

  return (
    <Document title={`${p.name} — Resume`} author={p.name} subject={p.title} creator={p.name} producer={p.name}>
      <Page size={PAGE_SIZE[r.paper]} style={s.page}>
        {/* sidebar */}
        <View style={s.aside}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop */}
          {r.showPhoto && photo && <Image style={s.photo} src={photo} />}

          {contact.length > 0 && (
            <View style={[s.sideSection, { marginTop: 0 }]}>
              <Text style={s.sideH2}>Contact</Text>
              {contact.map((c, i) => (
                <View key={i} style={s.contactRow} wrap={false}>
                  <View style={s.contactIcon}>
                    <Icon name={c.icon} size={8 * k} color={tint(r.accent, 0.8)} />
                  </View>
                  {c.href ? (
                    <Link src={c.href} style={[s.contactText, c.text.length > 30 ? s.contactLong : {}]}>
                      {c.text}
                    </Link>
                  ) : (
                    <Text style={[s.contactText, c.text.length > 30 ? s.contactLong : {}]}>{c.text}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {d.skills.length > 0 && (
            <View style={s.sideSection}>
              <Text style={s.sideH2} minPresenceAhead={40}>
                Skills
              </Text>
              {d.skills.map((g, i) => (
                <View key={i} style={s.skill} wrap={false}>
                  {g.category !== '' && <Text style={s.h4}>{g.category}</Text>}
                  <View style={s.chips}>
                    {g.items.map((it, j) => (
                      <Text key={j} style={s.chip}>
                        {it}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {d.education.length > 0 && (
            <View style={s.sideSection}>
              <Text style={s.sideH2} minPresenceAhead={40}>
                Education
              </Text>
              {d.education.map((e) => (
                <View key={e.id} style={s.edu} wrap={false}>
                  <Text style={s.degree}>{e.degree}</Text>
                  {e.school !== '' && <Text style={s.school}>{e.school}</Text>}
                  <View style={s.eduMeta}>
                    <Text style={s.eduDate}>{range(e.start, e.end, ' – ')}</Text>
                    {e.score !== '' && <Text style={s.score}>{e.score}</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {d.certifications.length > 0 && (
            <View style={s.sideSection}>
              <Text style={s.sideH2} minPresenceAhead={40}>
                Certifications
              </Text>
              {d.certifications.map((c) => (
                <View key={c.id} style={s.edu} wrap={false}>
                  {c.url ? (
                    <Link src={c.url} style={[s.degree, { textDecoration: 'none' }]}>
                      {c.name || c.course}
                    </Link>
                  ) : (
                    <Text style={s.degree}>{c.name || c.course}</Text>
                  )}
                  {(c.name && c.course ? c.course : '') + c.issuer + c.date !== '' && (
                    <Text style={s.school}>{[c.name ? c.course : '', c.issuer, c.date].filter(Boolean).join('  ·  ')}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {d.achievements.length > 0 && (
            <View style={s.sideSection}>
              <Text style={s.sideH2} minPresenceAhead={40}>
                Achievements
              </Text>
              {d.achievements.map((a, i) => (
                <View key={i} style={s.sideBullet}>
                  <View style={s.sideDot} />
                  <Text style={s.sideText}>{a}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* main column */}
        <View style={s.main}>
          <Text style={s.name}>{p.name}</Text>
          {roles.length > 0 && <Text style={s.role}>{roles.join('   ·   ')}</Text>}
          <View style={s.bar} />

          {d.summary !== '' && (
            <Section s={s} title="Profile">
              <Text style={s.summary}>{d.summary}</Text>
            </Section>
          )}

          {d.experience.length > 0 && (
            <Section s={s} title="Experience">
              {d.experience.map((x) => (
                <View key={x.id} style={s.entry} wrap={false}>
                  <View style={s.rowTop}>
                    <Text style={s.h3}>
                      {x.role}
                      {x.company !== '' && <Text style={s.at}>{`  ·  ${x.company}`}</Text>}
                    </Text>
                    {(x.start || x.end) !== '' && <Text style={s.date}>{range(x.start, x.end, ' – ')}</Text>}
                  </View>
                  {x.location !== '' && <Text style={s.meta}>{x.location}</Text>}
                  {x.tech.length > 0 && <Text style={s.tech}>{x.tech.join('  ·  ')}</Text>}
                  <Bullets s={s} items={x.bullets} />
                </View>
              ))}
            </Section>
          )}

          {projects.length > 0 && (
            <Section s={s} title="Projects">
              {projects.map((x) => {
                const links = r.showProjectLinks ? projectLinks(x).slice(0, 2) : [];
                return (
                  <View key={x.id} style={s.entry} wrap={false}>
                    <View style={s.rowTop}>
                      <Text style={s.h3}>
                        {x.name}
                        {x.subtitle !== '' && <Text style={s.at}>{`  ·  ${x.subtitle}`}</Text>}
                      </Text>
                      {(x.start || x.end) !== '' && <Text style={s.date}>{range(x.start, x.end, ' – ')}</Text>}
                    </View>
                    {x.tech.length > 0 && <Text style={s.tech}>{x.tech.join('  ·  ')}</Text>}
                    {links.length > 0 && (
                      <View style={s.plinks}>
                        {links.map((l, i) => (
                          <View key={i} style={s.plink}>
                            <Icon name={iconFor(l)} size={7.4 * k} color={r.accent} />
                            <Link src={l.url} style={s.plinkText}>
                              {pretty(l.url)}
                            </Link>
                          </View>
                        ))}
                      </View>
                    )}
                    {x.bullets.length > 0 ? <Bullets s={s} items={x.bullets} /> : x.summary !== '' && <Text style={s.bulletText}>{x.summary}</Text>}
                  </View>
                );
              })}
            </Section>
          )}
        </View>
      </Page>
    </Document>
  );
}

// ---------- building blocks ----------

type S = ReturnType<typeof styles>;

function Section({ s, title, children }: { s: S; title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.h2} minPresenceAhead={40}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Bullets({ s, items }: { s: S; items: string[] }) {
  return (
    <>
      {items.map((b, i) => (
        <View key={i} style={s.bullet}>
          <View style={s.dotWrap}>
            <View style={s.dot} />
          </View>
          <Text style={s.bulletText}>{b}</Text>
        </View>
      ))}
    </>
  );
}
