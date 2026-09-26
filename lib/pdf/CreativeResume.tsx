import { Document, Page, View, Text, Link, Image, StyleSheet, Svg, Defs, LinearGradient, Stop, Rect } from '@react-pdf/renderer';
import { projectLinks } from '../links';
import { PAGE_SIZE, Icon, iconFor, pretty, range, selectedProjects, shade, telHref, tint, type DocProps } from './shared';

// Two-column "creative" layout: bold header with gradient rule, main column (profile, experience, projects)
// and a tinted sidebar (skills, education, extras). Everything is sized from `k` so the auto-fit can scale it.

const INK = '#0f172a';
const BODY = '#334155';
const MUTED = '#64748b';

function styles(accent: string, k: number) {
  const soft = tint(accent, 0.93);
  const line = tint(accent, 0.75);
  const deep = shade(accent, 0.15);
  return StyleSheet.create({
    page: { fontFamily: 'Inter', fontSize: 8.6 * k, color: BODY, paddingTop: 28, paddingBottom: 26, paddingHorizontal: 32, lineHeight: 1.36 },
    header: { flexDirection: 'row', alignItems: 'center' },
    photo: { width: 58 * k, height: 58 * k, borderRadius: 29 * k, marginRight: 12 * k, objectFit: 'cover' },
    idBlock: { flexGrow: 1, flexShrink: 1, paddingRight: 10 },
    name: { fontFamily: 'Sora', fontWeight: 700, fontSize: 25 * k, color: INK, letterSpacing: -0.4, lineHeight: 1.1 },
    nameLast: { color: accent },
    roleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 4 * k },
    role: { fontWeight: 600, fontSize: 9.2 * k, color: deep, letterSpacing: 0.2 },
    roleDot: { width: 3.2 * k, height: 3.2 * k, borderRadius: 1.6 * k, backgroundColor: line, marginHorizontal: 6 * k },
    contact: { width: 196, flexShrink: 0 },
    contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2.4 * k },
    contactIcon: { width: 12 * k, marginRight: 4 * k, alignItems: 'center' },
    contactText: { fontSize: 7.8 * k, color: BODY, textDecoration: 'none' },
    rule: { marginTop: 10 * k, marginBottom: 2 * k },
    cols: { flexDirection: 'row', flexGrow: 1 },
    main: { width: '63%', paddingRight: 14 * k },
    aside: { width: '37%', backgroundColor: soft, borderRadius: 6, paddingHorizontal: 10 * k, paddingTop: 2 * k, paddingBottom: 8 * k, marginTop: 8 * k },
    section: { marginTop: 9 * k },
    h2Row: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 * k },
    h2Mark: { width: 10 * k, height: 3 * k, borderRadius: 1.5 * k, backgroundColor: accent, marginRight: 5 * k },
    h2: { fontFamily: 'Sora', fontWeight: 600, fontSize: 9.4 * k, color: accent, letterSpacing: 1.3, textTransform: 'uppercase' },
    h2Line: { flexGrow: 1, height: 0.7, backgroundColor: line, marginLeft: 6 * k },
    summary: { fontSize: 8.6 * k, color: BODY, lineHeight: 1.45 },
    entry: { marginBottom: 7 * k },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    h3: { fontWeight: 700, fontSize: 9.2 * k, color: INK, flex: 1, paddingRight: 8 },
    at: { fontWeight: 500, color: deep },
    date: { marginLeft: 4, fontWeight: 600, fontSize: 7.4 * k, color: deep, backgroundColor: soft, paddingVertical: 1.4 * k, paddingHorizontal: 5 * k, borderRadius: 7 * k, flexShrink: 0 },
    meta: { fontSize: 7.8 * k, color: MUTED },
    tech: { fontStyle: 'italic', fontSize: 7.8 * k, color: MUTED, marginTop: 1.2 * k, marginBottom: 1.6 * k },
    plinks: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 1.6 * k },
    plink: { flexDirection: 'row', alignItems: 'center', marginRight: 9 * k },
    plinkText: { fontSize: 7.6 * k, color: deep, textDecoration: 'none', marginLeft: 3 * k },
    bullet: { flexDirection: 'row', marginTop: 1.6 * k },
    dotWrap: { width: 9 * k, paddingTop: 3.3 * k },
    dot: { width: 3.2 * k, height: 3.2 * k, borderRadius: 1.6 * k, backgroundColor: accent },
    bulletText: { flex: 1, fontSize: 8.4 * k, color: BODY },
    // sidebar
    skill: { marginBottom: 5.5 * k },
    h4: { fontWeight: 700, fontSize: 7.5 * k, color: INK, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2.6 * k },
    chips: { flexDirection: 'row', flexWrap: 'wrap' },
    chip: { fontWeight: 500, fontSize: 7.3 * k, color: BODY, backgroundColor: '#ffffff', borderWidth: 0.6, borderColor: line, borderRadius: 3 * k, paddingVertical: 1.3 * k, paddingHorizontal: 4.2 * k, marginRight: 2.6 * k, marginBottom: 2.6 * k, lineHeight: 1.25 },
    edu: { marginBottom: 6 * k },
    degree: { fontWeight: 700, fontSize: 8.2 * k, color: INK, lineHeight: 1.3 },
    school: { fontSize: 7.6 * k, color: MUTED, marginTop: 1 * k },
    eduMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 1.8 * k },
    eduDate: { fontWeight: 600, fontSize: 7.5 * k, color: deep },
    score: { fontWeight: 600, fontSize: 7.5 * k, color: INK },
    ach: { fontSize: 7.8 * k, color: BODY },
  });
}

export function CreativeResume({ data: d, scale: k, photo }: DocProps) {
  const r = d.settings.resume;
  const s = styles(r.accent, k);
  const p = d.profile;
  const [first, ...rest] = p.name.split(' ');
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
        {/* header */}
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop */}
          {r.showPhoto && photo && <Image style={s.photo} src={photo} />}
          <View style={s.idBlock}>
            <Text style={s.name}>
              {first} <Text style={s.nameLast}>{rest.join(' ')}</Text>
            </Text>
            <View style={s.roleRow}>
              {roles.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {i > 0 && <View style={s.roleDot} />}
                  <Text style={s.role}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={s.contact}>
            {contact.map((c, i) => (
              <View key={i} style={s.contactRow}>
                <View style={s.contactIcon}>
                  <Icon name={c.icon} size={8 * k} color={r.accent} />
                </View>
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

        <Svg style={s.rule} height={3} width="100%">
          <Defs>
            <LinearGradient id="g" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={r.accent} />
              <Stop offset="0.55" stopColor={tint(r.accent, 0.55)} />
              <Stop offset="1" stopColor={tint(r.accent, 0.92)} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="1000" height="3" rx="1.5" fill="url(#g)" />
        </Svg>

        <View style={s.cols}>
          {/* main column */}
          <View style={s.main}>
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

          {/* sidebar */}
          <View style={s.aside}>
            {d.skills.length > 0 && (
              <Section s={s} title="Skills">
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
              </Section>
            )}

            {d.education.length > 0 && (
              <Section s={s} title="Education">
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
              </Section>
            )}

            {d.certifications.length > 0 && (
              <Section s={s} title="Certifications">
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
              </Section>
            )}

            {d.achievements.length > 0 && (
              <Section s={s} title="Achievements">
                {d.achievements.map((a, i) => (
                  <View key={i} style={s.bullet}>
                    <View style={s.dotWrap}>
                      <View style={s.dot} />
                    </View>
                    <Text style={[s.bulletText, s.ach]}>{a}</Text>
                  </View>
                ))}
              </Section>
            )}
          </View>
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
      <View style={s.h2Row} minPresenceAhead={40}>
        <View style={s.h2Mark} />
        <Text style={s.h2}>{title}</Text>
        <View style={s.h2Line} />
      </View>
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
