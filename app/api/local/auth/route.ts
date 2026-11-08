import { isSameOrigin } from '@/lib/local/origin';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateSession, currentUser, deleteCurrentAccount, destroySession } from '@/lib/local/server';
export const runtime = 'nodejs';
export async function GET() {
  return NextResponse.json({ data: { user: await currentUser() }, error: null });
}
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: { message: 'Invalid origin.' } }, { status: 403 });
  try {
    const { action, ...input } = await request.json();
    if (action === 'delete-account') {
      await deleteCurrentAccount();
      return NextResponse.json({ data: { user: null }, error: null });
    }
    if (action === 'logout') {
      await destroySession();
      return NextResponse.json({ data: { user: null }, error: null });
    }
    const user = await authenticateSession(action, input);
    return NextResponse.json({ data: { user }, error: null });
  } catch (error) {
    return NextResponse.json({ data: null, error: { message: error instanceof Error ? error.message : 'Authentication failed.' } }, { status: 400 });
  }
}
