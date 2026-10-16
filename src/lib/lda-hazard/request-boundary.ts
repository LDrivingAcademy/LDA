export class HazardRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function readHazardRequest(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site'
    || request.headers.get('x-lda-hazard-request') !== '1') throw new HazardRequestError(403, 'Request verification failed. Refresh the page.');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new HazardRequestError(415, 'JSON required');
  const limit = 32768;
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new HazardRequestError(413, 'Request too large');
  if (!request.body) throw new HazardRequestError(400, 'Request body required');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HazardRequestError(413, 'Request too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let data: unknown;
  try { data = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)); }
  catch { throw new HazardRequestError(400, 'Invalid JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HazardRequestError(400, 'JSON object required');
  return data as Record<string, unknown>;
}
