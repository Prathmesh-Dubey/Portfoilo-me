import 'server-only';
import { MongoClient, type Db, type Document } from 'mongodb';

// All site data lives in MongoDB (MONGODB_URI, database MONGODB_DB — default "reuseme"), so the site runs on
// serverless hosts like Vercel where the disk is read-only and every request may hit a different server.
//
// Collections (_id in brackets):
//   portfolios  [tenant id]  { data }                        tenant id = OWNER for the owner's site, else the member slug
//   backups                  { tenant, at, data }            last 30 saves per portfolio
//   files       [tenant:name]{ tenant, name, type, data, at } photo, uploaded resume PDF, project screenshots
//   accounts    ['owner']    { email, salt, hash }            the owner's login
//   members     [slug]  payments [id]  users [id]  suggestions [id]  resumes [draft id]
//   codes       [purpose:email] one-time email codes     } removed automatically when `expireAt` passes
//   limits      [key]           rate-limit counters      }

export const OWNER = '@owner';

type Cache = { client?: Promise<MongoClient>; ready?: Promise<void> };
const g = globalThis as unknown as { _reuseMeMongo?: Cache };
const cache: Cache = (g._reuseMeMongo ??= {}); // survives dev hot reloads, so connections aren't leaked

export async function db(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Add your MongoDB Atlas connection string to .env.local (and to your host’s environment variables).');
  cache.client ??= new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 10_000 }).connect().catch((e) => {
    cache.client = undefined;
    throw e;
  });
  const database = (await cache.client).db(process.env.MONGODB_DB || 'reuseme');
  cache.ready ??= ensureIndexes(database).catch((e) => {
    cache.ready = undefined;
    throw e;
  });
  await cache.ready;
  return database;
}

export async function col<T extends Document = Document>(name: string) {
  return (await db()).collection<T>(name);
}

async function ensureIndexes(d: Db) {
  await Promise.all([
    d.collection('codes').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
    d.collection('limits').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
    d.collection('backups').createIndex({ tenant: 1, at: -1 }),
    d.collection('files').createIndex({ tenant: 1 }),
    d.collection('members').createIndex({ email: 1 }),
    d.collection('users').createIndex({ email: 1 }, { unique: true }),
    d.collection('payments').createIndex({ email: 1, createdAt: -1 }),
    d.collection('suggestions').createIndex({ at: -1 }),
  ]);
}

/** Drops Mongo's _id so documents look exactly like the plain objects the app used before. */
export function plain<T>(doc: (T & { _id?: unknown }) | null): T | null {
  if (!doc) return null;
  const { _id, ...rest } = doc; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest as T;
}
