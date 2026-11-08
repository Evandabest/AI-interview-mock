import { isSameOrigin } from '@/lib/local/origin';
import { NextRequest, NextResponse } from 'next/server';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { currentUser } from '@/lib/local/server';
export const runtime = 'nodejs';
type Context = { params: Promise<{ path: string[] }> };
const mimeTypes: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
async function filePath(context: Context) {
  const { path } = await context.params;
  if (path.length !== 2 || path[0] !== 'pictures' || !/^[\w.-]+$/.test(path[1]) || !mimeTypes[extname(path[1]).toLowerCase()]) throw new Error('Invalid image path.');
  return resolve(process.env.UPLOAD_DIR || 'data/uploads', ...path);
}
export async function GET(_request: NextRequest, context: Context) {
  try {
    const path = await filePath(context);
    return new NextResponse(new Uint8Array(await readFile(path)), { headers: { 'Content-Type': mimeTypes[extname(path).toLowerCase()], 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new NextResponse('Not found', { status: 404 }); }
}
export async function POST(request: NextRequest, context: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: { message: 'Invalid origin.' } }, { status: 403 });
  if (!await currentUser()) return NextResponse.json({ error: { message: 'Please log in first.' } }, { status: 401 });
  try {
    const path = await filePath(context);
    const file = (await request.formData()).get('file');
    if (!(file instanceof File) || !Object.values(mimeTypes).includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Upload an image up to 10 MB.');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
    return NextResponse.json({ data: { path: (await context.params).path[1] }, error: null });
  } catch (error) { return NextResponse.json({ data: null, error: { message: error instanceof Error ? error.message : 'Upload failed.' } }, { status: 400 }); }
}
