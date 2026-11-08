import { isSameOrigin } from '@/lib/local/origin';
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/local/query';
import { currentUser } from '@/lib/local/server';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ data: null, error: { message: 'Invalid origin.' } }, { status: 403 });
  try {
    const query = await request.json();
    const result = executeQuery(query, await currentUser());
    return NextResponse.json(result, { status: result.error ? 400 : 200 });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Invalid request.' } }, { status: 400 });
  }
}
