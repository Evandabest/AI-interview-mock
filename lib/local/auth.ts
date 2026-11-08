import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { getDatabase } from './database';
import type { Row, User } from './types';

export const SESSION_COOKIE = 'bidbay_session';
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function publicUser(row: Row): User {
  return { id: row.id, email: row.email, user_metadata: { username: row.username } };
}
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function getUser(token?: string): User | null {
  if (!token) return null;
  const row = getDatabase().prepare(`SELECT Users.* FROM sessions JOIN Users ON Users.id = sessions.user_id
    WHERE token_hash = ? AND expires_at > ?`).get(tokenHash(token), Date.now()) as Row | undefined;
  return row ? publicUser(row) : null;
}
export function signOut(token?: string) {
  if (token) getDatabase().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
}
export function deleteAccount(token?: string) {
  const user = getUser(token);
  if (!user) throw new Error('Please log in to delete your account.');
  const db = getDatabase();
  // Keep historical records and their original account IDs intact for this demo.
  // This synchronous operation restores enforcement before any other request runs.
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      db.prepare('DELETE FROM Users WHERE id = ?').run(user.id);
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}
export function authenticate(action: string, input: Row) {
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || password.length > 1024) {
    throw new Error('Enter a valid email and a password of 6–1024 characters.');
  }
  const db = getDatabase();
  return db.transaction(() => {
    if (action === 'signup') {
      const username = String(input.options?.data?.username || '').trim();
      if (!username) throw new Error('Username is required.');
      if (db.prepare('SELECT id FROM Users WHERE email = ?').get(email)) throw new Error('Email already registered.');
      // Local interview accounts can bid immediately using a demo balance.
      db.prepare("INSERT INTO Users (id, created_at, username, email, password_hash, type, balance) VALUES (?, ?, ?, ?, ?, 'user', 100000)")
        .run(randomUUID(), new Date().toISOString(), username, email, hashPassword(password));
    } else if (action !== 'login') throw new Error('Unknown authentication action.');
    const row = db.prepare('SELECT * FROM Users WHERE email = ?').get(email) as Row | undefined;
    const [salt, expected] = String(row?.password_hash || '').split(':');
    if (!row || !salt || !expected || !timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(expected, 'hex'))) {
      throw new Error('Invalid email or password.');
    }
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(tokenHash(token), row.id, Date.now() + SESSION_SECONDS * 1000);
    return { user: publicUser(row), token };
  })();
}
