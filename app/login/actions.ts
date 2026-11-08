'use server'
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authenticateSession } from '@/lib/local/server';

export async function login(formData: FormData) {
  try {
    await authenticateSession('login', { email: formData.get('email'), password: formData.get('password') });
  } catch { redirect('/error'); }
  revalidatePath('/', 'layout');
  redirect('/profile');
}
export async function signup(formData: FormData) {
  try {
    await authenticateSession('signup', {
      email: formData.get('email'), password: formData.get('password'),
      options: { data: { username: formData.get('username') } },
    });
  } catch { redirect('/error'); }
  revalidatePath('/', 'layout');
  redirect('/home');
}
