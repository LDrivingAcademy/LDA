import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMarketplaceRoleState } from '@/lib/account-route-guard';
import { isRateLimited, jsonNoStore } from '@/lib/security';
import { HazardRequestError, readHazardRequest } from '../request-boundary';
import { validateHazardRelease } from '../release-validation';
import { currentMediaObject, validMediaRange, mediaStreamResponse } from '../media-policy';
import { supabaseUrl } from '@/lib/supabase/config';
import releaseData from './release.json';
import { MockError, validatedSets, practiceSets } from './mock-tests.mjs';
import { PersistentMocks, SupabaseMockStore } from './persistent-mocks.mjs';
import { weakAreaRecommendations } from './weak-areas.mjs';

const release = validateHazardRelease(releaseData);
const sets = release ? validatedSets(release.manifests, release.catalog) : [];
const individualSets = release ? practiceSets(release.catalog) : [];
export const hazardReleaseAvailable = Boolean(release && sets.length);

async function authenticatedOwner() {
  const client = await createClient();
  if (!client) throw new HazardRequestError(503, 'Sign-in service is unavailable');
  const {data: {user}, error} = await client.auth.getUser();
  if (error || !user || user.is_anonymous) throw new HazardRequestError(401, 'Sign in to your learner account to practise');
  const roles = await getMarketplaceRoleState(client, user.id);
  if (!roles.isAdmin && roles.effectiveRole !== 'learner') throw new HazardRequestError(403, 'A learner account is required');
  return user.id;
}

function response(value: unknown, status = 200) {
  // The mock engine already returns a whitelist. Only adapt its neutral media URL;
  // never spread private database rows or the release catalog into a response.
  if (value && typeof value === 'object' && 'clip' in value) {
    const clip = (value as {clip: {clip_id: string}}).clip;
    value = {...value, clip: {...clip, video_url: `/api/lda-hazard/media/${clip.clip_id}`}};
  }
  return jsonNoStore(value, {status, headers:{'X-Content-Type-Options':'nosniff','Vary':'Cookie'}});
}
export async function handleHazardApi(request: Request, segments: string[]) {
  try {
    if (segments.length > 3) throw new HazardRequestError(404, 'Not found');
    // Supplemental worker-local throttle; durable attempt uniqueness and revision
    // checks remain the authoritative cross-worker state boundary.
    if (isRateLimited(request, 'lda-hazard-api', 120)) throw new HazardRequestError(429, 'Please wait a moment before retrying');
    const body = request.method === 'POST' ? await readHazardRequest(request) : null;
    const owner = await authenticatedOwner();
    if (request.method === 'GET' && segments.join('/') === 'sets') {
      let activeAttempt: string | null = null;
      if (hazardReleaseAvailable) {
        const admin = createAdminClient();
        if (!admin) throw new HazardRequestError(503, 'Practice service is unavailable');
        const {data,error} = await admin.from('lda_hazard_mock_attempts').select('id')
          .eq('owner_id',owner).eq('finished',false).gt('expires_ms',Date.now()).maybeSingle();
        if (error) throw new HazardRequestError(503, 'Attempt storage unavailable');
        activeAttempt = data?.id ?? null;
      }
      return response({available:hazardReleaseAvailable, active_attempt_id:activeAttempt,
        instructional_review_pending:release?.review_policy === 'owner-authorised-provisional',
        sets:sets.map((s,i) => ({set_id:s.set_id,title:`Mock test ${i+1}`,clip_count:14}))});
    }
    if (!hazardReleaseAvailable) throw new HazardRequestError(503, 'The new clip library is not released yet');
    const admin = createAdminClient();
    if (!admin) throw new HazardRequestError(503, 'Practice service is unavailable');
    if(request.method==='GET'&&segments.length===1&&['practice','weak-areas'].includes(segments[0])){
      const active=await admin.from('lda_hazard_mock_attempts').select('id').eq('owner_id',owner)
        .eq('finished',false).gt('expires_ms',Date.now()).maybeSingle();
      if(active.error)throw new HazardRequestError(503,'Attempt storage unavailable');
      if(active.data)throw new HazardRequestError(409,'Finish or end your current attempt before viewing practice recommendations');
      const clips=release!.catalog.map((c,i)=>({clip_id:c.public_id,title:`Practice clip ${i+1}`,duration_seconds:c.duration_seconds,max_score:c.hazards.length*5}));
      if(segments[0]==='practice')return response({clips});
      const history=await admin.from('lda_hazard_mock_attempts').select('finished,payload').eq('owner_id',owner)
        .eq('finished',true).order('created_at',{ascending:false}).limit(50);
      if(history.error)throw new HazardRequestError(503,'Practice history unavailable');
      return response({areas:weakAreaRecommendations(history.data??[],release!.catalog),clips});
    }
    if (['GET','HEAD'].includes(request.method) && segments.length === 2 && segments[0] === 'media') {
      if (!/^[a-f0-9]{24}$/.test(segments[1])) throw new HazardRequestError(404, 'Clip unavailable');
      const {data,error} = await admin.from('lda_hazard_mock_attempts')
        .select('id,owner_id,finished,expires_ms,payload').eq('owner_id',owner)
        .eq('finished',false).gt('expires_ms',Date.now()).maybeSingle();
      if (error) throw new HazardRequestError(503, 'Playback service unavailable');
      const object = release && currentMediaObject(data, owner, segments[1], release);
      if (!object) throw new HazardRequestError(404, 'Clip unavailable');
      const range = request.headers.get('range');
      if (!validMediaRange(range)) throw new HazardRequestError(416, 'Unsupported byte range');
      // The signed URL stays server-side. Streaming avoids buffering a whole MP4
      // in function memory; every range request repeats owner/current-clip checks.
      const signed = await admin.storage.from('lda-hazard-clips').createSignedUrl(object, 90);
      if (signed.error || !signed.data?.signedUrl || !supabaseUrl) throw new HazardRequestError(503, 'Clip temporarily unavailable');
      const url = new URL(signed.data.signedUrl);
      if (url.origin !== new URL(supabaseUrl).origin || !url.pathname.startsWith('/storage/v1/object/sign/lda-hazard-clips/'))
        throw new HazardRequestError(503, 'Playback configuration unavailable');
      const upstream = await fetch(url, {method:request.method, cache:'no-store', redirect:'error',
        signal:AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
        headers:range ? {Range:range, 'Accept-Encoding':'identity'} : {'Accept-Encoding':'identity'}});
      return await mediaStreamResponse(upstream, request.method === 'HEAD');
    }
    const mocks = new PersistentMocks({sets:[...sets,...individualSets], store:new SupabaseMockStore(admin)});
    if (request.method === 'POST' && body) {
      const operation = body.operation_id;
      if (typeof operation !== 'string' || !/^[a-f0-9]{32,64}$/.test(operation)) throw new HazardRequestError(400, 'Invalid operation');
      if (segments.join('/') === 'mocks') {
        if (typeof body.set_id !== 'string') throw new HazardRequestError(400, 'Select a mock test');
        if(!sets.some(s=>s.set_id===body.set_id))throw new HazardRequestError(404,'Mock test unavailable');
        return response(await mocks.begin(owner, body.set_id, operation), 201);
      }
      if(segments.join('/')==='practice'){
        if(typeof body.clip_id!=='string'||!individualSets.some(s=>s.set_id===`practice-${body.clip_id}`))throw new HazardRequestError(404,'Practice clip unavailable');
        return response(await mocks.begin(owner,`practice-${body.clip_id}`,operation),201);
      }
      if (segments[0] === 'mocks' && /^[a-f0-9]{48}$/.test(segments[1] ?? '') && ['ready','submit','abandon'].includes(segments[2]))
        return response(await mocks.operate(owner, segments[1], segments[2], body, operation));
    }
    throw new HazardRequestError(404, 'Not found');
  } catch (error) {
    if (error instanceof HazardRequestError || error instanceof MockError) return response({error:error.message}, error.status);
    return response({error:'Practice service is temporarily unavailable. Retry the same request.'}, 503);
  }
}
