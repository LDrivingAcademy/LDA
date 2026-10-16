import 'server-only';
// SERVER ONLY. Store payloads contain private answer snapshots, never API DTOs.
import {createHash} from 'node:crypto';
import {MockTests,MockError} from './mock-tests.mjs';

const operationPattern=/^[a-f0-9]{32,64}$/;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ended=state=>['complete','abandoned'].includes(state);

/**
 * Durable boundary around the already-tested mock engine. The store must:
 * - persist rows across workers/restarts;
 * - enforce one unexpired active attempt per owner on create;
 * - atomically compare id + owner + revision in compareAndSwap;
 * - never be accessible directly to learners (the payload includes answers).
 * Owner must come from verified server authentication, NOT the request body.
 */
export class PersistentMocks {
  constructor({sets,store,now=()=>Date.now()}) {
    this.sets=sets;this.store=store;this.now=now;
  }

  async begin(owner,setId,operationId) {
    if(typeof owner!=='string'||!owner)throw new MockError(401,'Sign in required');
    if(!operationPattern.test(operationId??''))throw new MockError(400,'Invalid operation');
    // Deterministic per-owner id makes a lost begin response recoverable across
    // workers without allowing the client to choose or overwrite another row.
    const id=digest(['lda-mock-begin-v1',owner,operationId]).slice(0,48);
    const beginHash=digest({set_id:setId});
    const recover=row=>{
      if(row.owner_id!==owner||row.id!==id||row.expires_ms<=this.now())throw new MockError(409,'Start request expired; use a new operation');
      if(row.payload.begin.request_hash!==beginHash)throw new MockError(409,'Operation ID already used for a different request');
      return structuredClone(row.payload.begin.response);
    };
    const existing=await this.store.get(id,owner);
    if(existing)return recover(existing);
    const engine=new MockTests(this.sets,{now:this.now});
    const generated=engine.begin(owner,setId);
    const state=engine.get(owner,generated.attempt_id);state.id=id;
    const response=engine.current(state);
    const row={id:state.id,owner_id:owner,revision:0,expires_ms:state.expires,
      finished:false,payload:{state,operations:[],begin:{request_hash:beginHash,response}}};
    if(!await this.store.create(row,this.now())) {
      const raced=await this.store.get(id,owner);
      if(raced)return recover(raced);
      throw new MockError(409,'Finish or end the current mock test first');
    }
    // Only the existing public whitelist is returned, never the persisted row.
    return response;
  }

  async operate(owner,id,action,input,operationId) {
    if(!['ready','submit','abandon'].includes(action)||!operationPattern.test(operationId??''))
      throw new MockError(400,'Invalid operation');
    if(!input||typeof input!=='object'||Array.isArray(input))throw new MockError(400,'Invalid input');
    // Ignore extra untrusted fields, but hash all fields actually used to score.
    const request=action==='submit'?{clip_token:input.clip_token,clicks:input.clicks}:
      action==='ready'?{clip_token:input.clip_token}:{};
    const requestHash=digest({action,request});
    for(let race=0;race<2;race++) {
      const row=await this.store.get(id,owner);
      if(!row||row.owner_id!==owner||row.id!==id||row.expires_ms<=this.now())
        throw new MockError(404,'Mock attempt unavailable');
      const previous=row.payload.operations.find(o=>o.id===operationId);
      if(previous) {
        if(previous.request_hash!==requestHash)throw new MockError(409,'Operation ID already used for a different request');
        return structuredClone(previous.response);
      }
      const engine=new MockTests([],{now:this.now});
      const state=structuredClone(row.payload.state);
      if(state.id!==id||state.session!==owner||state.expires!==row.expires_ms)
        throw new MockError(503,'Stored attempt integrity check failed');
      engine.attempts.set(id,state);
      const response=action==='ready'?engine.ready(owner,id,request.clip_token):
        action==='submit'?engine.submit(owner,id,request):engine.abandon(owner,id);
      const operations=[...row.payload.operations,{id:operationId,request_hash:requestHash,response}];
      if(operations.length>30)throw new MockError(409,'Attempt operation limit reached');
      const next={...row,revision:row.revision+1,finished:ended(state.state),payload:{...row.payload,state,operations}};
      if(await this.store.compareAndSwap(next,row.revision,this.now()))return response;
      // A simultaneous request won the database update. Re-read: an identical
      // request returns its committed response; a different one fails sequencing.
    }
    throw new MockError(409,'Attempt changed; retry the same operation');
  }
}

/** Supabase server-admin adapter. No global maps or local disk in production.
 * The separate service-role client must have persistSession/autoRefreshToken off.
 * Table grants/RLS and authenticated API routes are required before use.
 */
export class SupabaseMockStore {
  constructor(adminClient){this.client=adminClient;this.table='lda_hazard_mock_attempts';}
  async create(row,now) {
    // Expiry releases the partial unique active-owner index without deleting history.
    const expired=await this.client.from(this.table).update({finished:true})
      .eq('owner_id',row.owner_id).eq('finished',false).lte('expires_ms',now);
    if(expired.error)throw new MockError(503,'Attempt storage unavailable');
    const {error}=await this.client.from(this.table).insert(row);
    if(error?.code==='23505')return false;
    if(error)throw new MockError(503,'Attempt storage unavailable');
    return true;
  }
  async get(id,owner) {
    const {data,error}=await this.client.from(this.table)
      .select('id,owner_id,revision,expires_ms,finished,payload').eq('id',id).eq('owner_id',owner).maybeSingle();
    if(error)throw new MockError(503,'Attempt storage unavailable');
    return data;
  }
  async compareAndSwap(row,expectedRevision,now) {
    const {data,error}=await this.client.from(this.table)
      .update({revision:row.revision,finished:row.finished,payload:row.payload})
      .eq('id',row.id).eq('owner_id',row.owner_id).eq('revision',expectedRevision)
      .gt('expires_ms',now).eq('finished',false).select('id');
    if(error)throw new MockError(503,'Attempt storage unavailable');
    return data?.length===1;
  }
}
