// Next.js can normalize request.nextUrl.hostname to localhost in development.
// Compare the browser's origin with the actual Host header instead.
export function isSameOrigin(request: { headers: Headers; nextUrl: { protocol: string } }) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.host === request.headers.get('host') && parsed.protocol === request.nextUrl.protocol;
  } catch { return false; }
}
