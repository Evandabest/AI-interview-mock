import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/local/server';
import { type NextRequest } from 'next/server';
export const runtime = 'nodejs';
// Local registration creates a session immediately; no email service is needed.
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL(await currentUser() ? '/profile' : '/login', request.url));
}
