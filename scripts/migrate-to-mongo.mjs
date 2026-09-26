// One-time copy of the old file storage (data/) into MongoDB: `npm run migrate:mongo`.
// Safe to run again: anything already in the database is left alone (pass --overwrite to replace portfolios and files).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { Binary, MongoClient } from 'mongodb';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'data');
const OWNER = '@owner';
const overwrite = process.argv.includes('--overwrite');

// read .env.local without extra dependencies
for (const line of existsSync(path.join(ROOT, '.env.local')) ? readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env.local first');

const json = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

const client = await new MongoClient(process.env.MONGODB_URI).connect();
const db = client.db(process.env.MONGODB_DB || 'reuseme');
const log = [];

async function put(collection, _id, doc, replace = overwrite) {
  const coll = db.collection(collection);
  if (!replace && (await coll.countDocuments({ _id }, { limit: 1 }))) return false;
  await coll.replaceOne({ _id }, doc, { upsert: true });
  return true;
}

async function migrateTenant(id, dir) {
  const portfolio = json(path.join(dir, 'portfolio.json'), null);
  if (!portfolio) return;
  if (await put('portfolios', id, { data: portfolio })) log.push(`portfolio ${id}`);

  const types = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  for (const ext of ['jpg', 'png']) {
    const f = path.join(dir, `photo.${ext}`);
    if (existsSync(f) && (await put('files', `${id}:photo`, { tenant: id, name: 'photo', type: types[ext], data: new Binary(readFileSync(f)), at: new Date() }))) log.push(`photo ${id}`);
  }
  const pdf = path.join(dir, 'resume.pdf');
  if (existsSync(pdf) && (await put('files', `${id}:resume.pdf`, { tenant: id, name: 'resume.pdf', type: 'application/pdf', data: new Binary(readFileSync(pdf)), at: new Date() }))) {
    log.push(`uploaded resume ${id}`);
  }
  const up = path.join(dir, 'uploads');
  for (const name of existsSync(up) ? readdirSync(up) : []) {
    const ext = name.split('.').pop();
    if (!types[ext]) continue;
    const full = path.join(up, name);
    if (await put('files', `${id}:uploads/${name}`, { tenant: id, name: `uploads/${name}`, type: types[ext], data: new Binary(readFileSync(full)), at: statSync(full).mtime })) log.push(`screenshot ${id}/${name}`);
  }

  const bdir = path.join(dir, 'backups');
  const backups = db.collection('backups');
  if (existsSync(bdir) && !(await backups.countDocuments({ tenant: id }, { limit: 1 }))) {
    const list = readdirSync(bdir).filter((f) => f.endsWith('.json')).sort().slice(-30);
    for (const f of list) {
      const data = json(path.join(bdir, f), null);
      if (data) await backups.insertOne({ tenant: id, at: statSync(path.join(bdir, f)).mtime, data });
    }
    if (list.length) log.push(`${list.length} backups ${id}`);
  }
}

await migrateTenant(OWNER, DATA);
const membersDir = path.join(DATA, 'members');
for (const slug of existsSync(membersDir) ? readdirSync(membersDir) : []) await migrateTenant(slug, path.join(membersDir, slug));

const admin = json(path.join(DATA, 'admin.json'), null);
if (admin?.email && admin.hash && (await put('accounts', 'owner', { email: admin.email, salt: admin.salt, hash: admin.hash }, false))) log.push('owner login (current password kept)');

for (const s of json(path.join(DATA, 'suggestions.json'), [])) {
  const { id, ...rest } = s;
  if (id && (await put('suggestions', id, rest, false))) log.push(`suggestion ${id}`);
}
for (const m of json(path.join(DATA, 'members.json'), [])) if (await put('members', m.slug, m, false)) log.push(`member ${m.slug}`);
for (const p of json(path.join(DATA, 'payments.json'), [])) {
  const { id, ...rest } = p;
  if (await put('payments', id, rest, false)) log.push(`payment ${p.ref}`);
}
for (const u of json(path.join(DATA, 'users.json'), [])) {
  const { id, ...rest } = u;
  if (await put('users', id, rest, false)) log.push(`free account ${u.email}`);
}

await client.close();
console.log(log.length ? `Copied to MongoDB:\n  ${log.join('\n  ')}` : 'Nothing new to copy: MongoDB already has everything.');
