import { Document, Page, View, Text, Link, StyleSheet } from '@react-pdf/renderer';
import { projectLinks } from '../links';
import { PAGE_SIZE, pretty, range, selectedProjects, telHref, type DocProps } from './shared';

// Single-column, ATS-first layout that mirrors the original Calibri resume (Carlito is metric-identical to Calibri).

const INK = '#000000';
const SOFT = '#3a3a3a';

function styles(accent: string, k: number) {
  return StyleSheet.create({
    page: { fontFamily: 'Carlito', fontSize: 9.5 * k, color: INK, paddingTop: 30, paddingBottom: 28, paddingHorizontal: 36, lineHeight: 1.22 },
    name: { fontWeight: 700, fontSize: 20 * k, lineHeight: 1.15, color: accent, textAlign: 'center', letterSpacing: 0.4 },
    title: { fontWeight: 700, fontSize: 10 * k, color: SOFT, textAlign: 'center', marginTop: 3 * k },
    contact: { fontSize: 9.5 * k, color: SOFT, textAlign: 'center', marginTop: 2.5 * k },
    a: { color: SOFT, textDecoration: 'none' },
    section: { marginTop: 8 * k },
    h2: { fontWeight: 700, fontSize: 10 * k, color: accent, textTransform: 'uppercase', borderBottomWidth: 0.75, borderBottomColor: accent, paddingBottom: 1.5 * k, marginBottom: 4 * k },
    p: { fontSize: 9.5 * k },
    skill: { marginBottom: 1.8 * k },
    b: { fontWeight: 700 },
    entry: { marginBottom: 5 * k },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    sub: { color: SOFT },
    date: { fontWeight: 700, color: SOFT, flexShrink: 0, paddingLeft: 8 },
    tech: { fontStyle: 'italic', fontSize: 9 * k, color: SOFT, marginTop: 0.8 * k },
    it: { fontStyle: 'italic', fontSize: 9 * k, color: SOFT },
    links: { fontSize: 9 * k, color: SOFT, marginTop: 0.8 * k },
    li: { flexDirection: 'row', marginTop: 1.8 * k },
    dot: { width: 10 * k, paddingLeft: 1 },
    liText: { flex: 1 },
  });
}

export function ClassicResume({ data: d, scale: k }: DocProps) {
  const r = d.settings.resume;
  const s = styles(r.accent, k);
  const p = d.profile;
  const projects = selectedProjects(d);

  const line1 = joinWithBars([
    ...(p.location ? [<Text key="loc">{p.location}</Text>] : []),
    ...(p.phone ? [<Link key="ph" src={telHref(p.phone)} style={s.a}>{p.phone}</Link>] : []),
    ...(p.email ? [<Link key="em" src={`mailto:${p.email}`} style={s.a}>{p.email}</Link>] : []),
  ]);
  const line2 = joinWithBars(
    p.links.filter((l) => l.showOnResume).map((l, i) => (
      <Link key={i} src={l.url} style={s.a}>
        {pretty(l.url)}
      </Link>
    )),
  );




  return (
    <Document title={`${p.name} — Resume`} author={p.name} subject={p.title} creator={p.name} producer={p.name}>
      <Page size={PAGE_SIZE[r.paper]} style={s.page}>
        <Text style={s.name}>{p.name.toUpperCase()}</Text>
        {p.title !== '' && <Text style={s.title}>{p.title}</Text>}
        {line1.length > 0 && <Text style={s.contact}>{line1}</Text>}
        {line2.length > 0 && <Text style={s.contact}>{line2}</Text>}

        {d.summary !== '' && (
          <Section s={s} title="Professional Summary">
            <Text style={s.p}>{d.summary}</Text>
          </Section>
        )}

        {d.skills.length > 0 && (
          <Section s={s} title="Technical Skills">
            {d.skills.map((g, i) => (
              <Text key={i} style={s.skill}>
                {g.category !== '' && <Text style={s.b}>{`${g.category}: `}</Text>}
                {g.items.join(', ')}
              </Text>
            ))}
          </Section>
        )}

        {d.experience.length > 0 && (
          <Section s={s} title="Experience">
            {d.experience.map((x) => (
              <Entry s={s} key={x.id} title={x.role} sub={[x.company, x.location].filter(Boolean).join(', ')} date={range(x.start, x.end, ' - ')} tech={x.tech} bullets={x.bullets} />
            ))}
          </Section>
        )}

        {projects.length > 0 && (
          <Section s={s} title="Projects">
            {projects.map((x) => (
              <Entry
                s={s}
                key={x.id}
                title={x.name}
                sub={x.subtitle}
                date={range(x.start, x.end, ' - ')}
                tech={x.tech}
                links={r.showProjectLinks ? projectLinks(x).slice(0, 2) : []}
                bullets={x.bullets.length ? x.bullets : x.summary ? [x.summary] : []}
              />
            ))}
          </Section>
        )}

        {d.education.length > 0 && (
          <Section s={s} title="Education">
            {d.education.map((e) => (
              <View key={e.id} style={s.entry} wrap={false}>
                <View style={s.row}>
                  <Text style={[s.b, { flexShrink: 1 }]}>{e.degree}</Text>
                  <Text style={s.date}>{range(e.start, e.end, ' - ')}</Text>
                </View>
                <View style={s.row}>
                  <Text style={[s.it, { flexShrink: 1 }]}>{e.school}</Text>
                  <Text style={[s.it, { paddingLeft: 8 }]}>{e.score}</Text>
                </View>
              </View>
            ))}
          </Section>
        )}

        {d.certifications.length > 0 && (
          <Section s={s} title="Certifications">
            {d.certifications.map((c) => (
              <View key={c.id} style={[s.row, { marginBottom: 2 * k }]} wrap={false}>
                <Text style={{ flexShrink: 1 }}>
                  {c.url ? (
                    <Link src={c.url} style={[s.b, s.a, { color: INK }]}>
                      {c.name || c.course}
                    </Link>
                  ) : (
                    <Text style={s.b}>{c.name || c.course}</Text>
                  )}
                  {[c.name ? c.course : '', c.issuer].filter(Boolean).map((v) => (
                    <Text key={v} style={s.sub}>{`  -  ${v}`}</Text>
                  ))}
                </Text>
                <Text style={s.date}>{c.date}</Text>
              </View>
            ))}
          </Section>
        )}

        {d.achievements.length > 0 && (
          <Section s={s} title="Achievements">
            <Bullets s={s} items={d.achievements} />
          </Section>
        )}
      </Page>
    </Document>
  );
}

// ---------- building blocks ----------

type S = ReturnType<typeof styles>;

const joinWithBars = (parts: React.ReactNode[]) =>
  parts.flatMap((part, i) => (i === 0 ? [part] : [<Text key={`sep${i}`}>{'  |  '}</Text>, part]));

function Section({ s, title, children }: { s: S; title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.h2} minPresenceAhead={30}>
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
        <View key={i} style={s.li}>
          <Text style={s.dot}>•</Text>
          <Text style={s.liText}>{b}</Text>
        </View>
      ))}
    </>
  );
}

function Entry({ s, ...props }: { s: S; title: string; sub: string; date: string; tech: string[]; bullets: string[]; links?: { url: string }[] }) {
  return (
    <View style={s.entry} wrap={false}>
      <View style={s.row}>
        <Text style={{ flexShrink: 1 }}>
          <Text style={s.b}>{props.title}</Text>
          {props.sub !== '' && <Text style={s.sub}>{`  -  ${props.sub}`}</Text>}
        </Text>
        <Text style={s.date}>{props.date}</Text>
      </View>
      {props.tech.length > 0 && <Text style={s.tech}>{props.tech.join(', ')}</Text>}
      {props.links && props.links.length > 0 && (
        <Text style={s.links}>
          {joinWithBars(
            props.links.map((l, i) => (
              <Link key={i} src={l.url} style={s.a}>
                {pretty(l.url)}
              </Link>
            )),
          )}
        </Text>
      )}
      <Bullets s={s} items={props.bullets} />
    </View>
  );
}
