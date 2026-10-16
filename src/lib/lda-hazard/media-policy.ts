import type { HazardRelease } from './release-validation';

// Pure boundary, independently testable. The caller supplies a server-verified
// owner and an owner-filtered private row; neither comes from learner input.
export function currentMediaObject(row: unknown, owner: string, publicId: string,
  release: HazardRelease, now = Date.now()): string | null {
  if (!/^[a-f0-9]{24}$/.test(publicId) || !row || typeof row !== 'object') return null;
  const r = row as {id?: string; owner_id?: string; finished?: boolean; expires_ms?: number;
    payload?: {state?: {id?: string; session?: string; expires?: number; state?: string;
      index?: number; clips?: Array<{public_id?: string; video_sha256?: string; storage_object?: string}>}}};
  const s = r.payload?.state;
  if (r.owner_id !== owner || r.finished !== false || !Number.isFinite(r.expires_ms)
    || r.expires_ms! <= now || !s || s.id !== r.id || s.session !== owner
    || s.expires !== r.expires_ms || !['loading','playing'].includes(s.state ?? '')
    || !Number.isInteger(s.index) || s.index! < 0 || !Array.isArray(s.clips)) return null;
  const clip = s.clips[s.index!];
  const approved = release.catalog.find(c => c.public_id === publicId);
  return clip?.public_id === publicId && approved && clip.video_sha256 === approved.video_sha256
    && clip.storage_object === approved.storage_object ? approved.storage_object : null;
}

export function validMediaRange(range: string | null): boolean {
  if (range === null) return true;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return false;
  const start = match[1] ? Number(match[1]) : null;
  const end = match[2] ? Number(match[2]) : null;
  if ([start,end].some(n => n !== null && (!Number.isSafeInteger(n) || n < 0))) return false;
  return start === null ? end! > 0 : end === null || end >= start;
}

export async function mediaStreamResponse(upstream: Response, head = false): Promise<Response> {
  const headers = new Headers({'Cache-Control':'private, no-store', 'Vary':'Cookie',
    'X-Content-Type-Options':'nosniff', 'Cross-Origin-Resource-Policy':'same-origin'});
  if (upstream.status === 416) {
    const contentRange = upstream.headers.get('content-range');
    if (contentRange && /^bytes \*\/\d+$/.test(contentRange)) headers.set('Content-Range', contentRange);
    await upstream.body?.cancel();
    return new Response(null, {status:416, headers});
  }
  const length = upstream.headers.get('content-length');
  const contentRange = upstream.headers.get('content-range');
  if (![200,206].includes(upstream.status) || upstream.headers.get('content-type')?.split(';')[0] !== 'video/mp4'
    || (length !== null && !/^\d+$/.test(length))
    || (upstream.status === 206 && (!contentRange || !/^bytes \d+-\d+\/\d+$/.test(contentRange)))) {
    await upstream.body?.cancel();
    return new Response(null, {status:502, headers});
  }
  headers.set('Content-Type','video/mp4'); headers.set('Accept-Ranges','bytes');
  if (length !== null) headers.set('Content-Length', length);
  if (upstream.status === 206) headers.set('Content-Range', contentRange!);
  if (head) await upstream.body?.cancel();
  return new Response(head ? null : upstream.body, {status:upstream.status, headers});
}
