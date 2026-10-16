// Public playback utilities only: no hazard labels, windows or scoring data.
export function initialBufferedSeconds(ranges: Pick<TimeRanges, 'length'|'start'|'end'>): number {
  let end = 0;
  for (let i = 0; i < ranges.length; i++) {
    if (ranges.start(i) > end + 0.05) break;
    end = Math.max(end, ranges.end(i));
  }
  return Number.isFinite(end) ? Math.max(0, end) : 0;
}

export function readyForProgressivePlayback(duration: number, buffered: number, elapsedSeconds: number): boolean {
  if (![duration, buffered, elapsedSeconds].every(Number.isFinite) || duration <= 0 || buffered < 0) return false;
  if (buffered >= duration - 0.1) return true;
  // Require an eight-second head start and a measured download rate at least
  // 30% faster than playback. Slow connections keep buffering to completion.
  // This is a startup estimate, not a guarantee about future network changes.
  return elapsedSeconds >= 0.75 && buffered >= Math.min(8, duration)
    && buffered / elapsedSeconds >= 1.3;
}

export function readyForPracticePlayback(duration: number, buffered: number, elapsedSeconds: number): boolean {
  if (![duration, buffered, elapsedSeconds].every(Number.isFinite) || duration <= 0 || buffered < 0) return false;
  if (buffered >= duration - 0.1) return true;
  // Practice mode is a learning tool, so it can start sooner than a scored
  // mock. If the network later stalls, the clip remains practice-only.
  return elapsedSeconds >= 0.5 && buffered >= Math.min(3, duration);
}

export type PlaybackEnvironment = {
  maxTouchPoints?: number;
  coarsePointer?: boolean;
  effectiveType?: string;
  downlink?: number;
};

export function shouldUseFullDownloadFirst(environment: PlaybackEnvironment): boolean {
  const effectiveType = environment.effectiveType?.toLowerCase();
  return effectiveType === 'slow-2g'
    || effectiveType === '2g'
    || effectiveType === '3g'
    || (Number.isFinite(environment.downlink) && (environment.downlink ?? Infinity) < 3);
}

export function shouldFallbackToFullDownload(progress: number|null, elapsedSeconds: number, loaded: boolean): boolean {
  if (loaded || !Number.isFinite(elapsedSeconds)) return false;
  if (progress === null) return elapsedSeconds >= 12;
  if (!Number.isFinite(progress) || progress < 0 || progress >= 1) return false;
  return elapsedSeconds >= 8 && progress < 0.12;
}

export async function downloadHazardVideo(response: Response, signal: AbortSignal,
  progress: (fraction: number|null) => void): Promise<Blob> {
  if (!response.ok || !response.headers.get('content-type')?.includes('video/mp4') || !response.body)
    throw new Error('The video could not be downloaded. End the attempt and retry.');
  const header = response.headers.get('content-length');
  const total = header === null ? null : Number(header);
  if (total !== null && (!Number.isSafeInteger(total) || total < 32 || total >= 50_000_000)) {
    await response.body.cancel();
    throw new Error('The video download has an unexpected size. End the attempt and retry.');
  }
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const {done, value} = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received >= 50_000_000 || (total !== null && received > total)) throw new Error('The video download exceeded its expected size.');
      chunks.push(new Uint8Array(value));
      progress(total === null ? null : received / total);
    }
    signal.throwIfAborted();
    if (received < 32 || (total !== null && received !== total)) throw new Error('The video download was incomplete. End the attempt and retry.');
    progress(1);
    return new Blob(chunks, {type:'video/mp4'});
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
