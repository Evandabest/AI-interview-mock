import { cookies } from 'next/headers';
import { authenticate, deleteAccount, getUser, signOut, SESSION_COOKIE, SESSION_SECONDS } from './auth';
import type { Row } from './types';

export async function currentUser() { return getUser((await cookies()).get(SESSION_COOKIE)?.value); }
export async function authenticateSession(action: string, input: Row) {
  const jar = await cookies();
  const result = authenticate(action, input);
  signOut(jar.get(SESSION_COOKIE)?.value);
  jar.set(SESSION_COOKIE, result.token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_SECONDS,
  });
  return result.user;
}
export async function destroySession() {
  const jar = await cookies();
  signOut(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}
export async function deleteCurrentAccount() {
  const jar = await cookies();
  deleteAccount(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}
