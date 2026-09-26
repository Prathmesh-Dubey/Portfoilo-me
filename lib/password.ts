import 'server-only';
import crypto from 'node:crypto';

const sha = (s: string) => crypto.createHash('sha256').update(s).digest();
export const safeEqual = (a: string, b: string) => crypto.timingSafeEqual(sha(a), sha(b));

export const newSalt = () => crypto.randomBytes(16).toString('hex');
export const hashPassword = (password: string, salt: string) => crypto.scryptSync(password, salt, 64).toString('hex');
export const verifyPassword = (password: string, salt: string, hash: string) => safeEqual(hashPassword(password, salt), hash);
