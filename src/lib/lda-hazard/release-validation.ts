// Pure validation only. Never import the answer-bearing release JSON from a client.
type ScoreBand = {start: number; end: number; score: number};
type Hazard = {start: number; end: number; label?:string; category?:string; teaching_note?:string; score_bands?: ScoreBand[]};
function validScoreBands(h: Hazard): boolean {
  if (h.score_bands === undefined) return true;
  return Array.isArray(h.score_bands) && h.score_bands.length === 5
    && h.score_bands.every((b, i) => b && Number.isFinite(b.start) && Number.isFinite(b.end)
      && b.end > b.start && b.score === 5-i && b.start === (i === 0 ? h.start : h.score_bands![i-1].end)
      && b.end <= h.end) && h.score_bands[4].end === h.end;
}
type PrivateClip = {
  clip_id: string; public_id: string; duration_seconds: number; max_score: number;
  title?:string; category?:string;
  hazards: Hazard[]; explanation: string;
  status: string; visual_review: string; scoring_review: string;
  source_sha256: string; video_sha256: string; storage_object: string;
};
type Manifest = {set_id: string; status: string; clip_ids: string[]; max_score: number; practice_pass_mark: number};
export type HazardRelease = {status: string; release_id: string | null; catalog: PrivateClip[]; manifests: Manifest[];
  review_policy?: 'owner-authorised-provisional'; owner_authorised?: boolean; instructional_review?: 'pending'};
const hash = /^[a-f0-9]{64}$/;
const opaque = /^[a-f0-9]{24}$/;
export function validateHazardRelease(input: unknown): HazardRelease | null {
  if (!input || typeof input !== 'object') return null;
  const r = input as HazardRelease;
  // Explicit owner-authorised practice release is distinct from instructional
  // approval. Never silently promote ordinary draft metadata to reviewed content.
  const provisional = r.review_policy === 'owner-authorised-provisional';
  if (provisional && (r.owner_authorised !== true || r.instructional_review !== 'pending')) return null;
  if (r.review_policy !== undefined && !provisional) return null;
  if (r.status !== 'verified-playable' || typeof r.release_id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(r.release_id)) return null;
  if (!Array.isArray(r.catalog) || r.catalog.length !== 15 || !Array.isArray(r.manifests) || !r.manifests.length) return null;
  if (new Set(r.catalog.map(c => c?.clip_id)).size !== 15 || new Set(r.catalog.map(c => c?.public_id)).size !== 15) return null;
  if (!r.catalog.every(c => c && typeof c.clip_id === 'string' && /^lda-[a-z0-9-]+$/.test(c.clip_id)
    && opaque.test(c.public_id) && c.status === (provisional ? 'verified-media' : 'verified-final') && c.visual_review === 'approved'
    && c.scoring_review === (provisional ? 'provisional' : 'approved')
    && Number.isFinite(c.duration_seconds) && c.duration_seconds >= 45 && c.duration_seconds <= 60
    && hash.test(c.source_sha256) && hash.test(c.video_sha256) && typeof c.explanation === 'string' && c.explanation.length > 0
    && c.storage_object === `${r.release_id}/${c.public_id}.mp4`
    && Array.isArray(c.hazards) && [1, 2].includes(c.hazards.length) && c.max_score === c.hazards.length * 5
    && c.hazards.every((h, i) => h && Number.isFinite(h.start) && Number.isFinite(h.end) && h.start >= 0 && h.end > h.start
      && h.end <= c.duration_seconds && validScoreBands(h) && (i === 0 || h.start >= c.hazards[i-1].end)))) return null;
  const clips = new Map(r.catalog.map(c => [c.clip_id, c]));
  if (new Set(r.manifests.map(m => m?.set_id)).size !== r.manifests.length) return null;
  if (!r.manifests.every(m => m && /^set-[1-9][0-9]*$/.test(m.set_id) && m.status === 'verified-playable'
    && Array.isArray(m.clip_ids) && m.clip_ids.length === 14 && new Set(m.clip_ids).size === 14
    && m.max_score === 75 && m.practice_pass_mark === 44
    && m.clip_ids.every(id => clips.has(id))
    && m.clip_ids.filter(id => clips.get(id)?.hazards.length === 1).length === 13
    && m.clip_ids.filter(id => clips.get(id)?.hazards.length === 2).length === 1)) return null;
  return r;
}
