// Delete only the temporary learner created for this release verification.
import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const id='54afdfeb-b33c-434d-8dce-95cb5edcbc1f';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_PROJECT_ID!=='prj_VN5AuDmkx5m2VRsEH7VADIfUtJI1')throw Error('Wrong deployment context');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if(url!=='https://vznbhgatsozzendikvvf.supabase.co'||!key)throw Error('Wrong database context');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const found=await admin.auth.admin.getUserById(id);
if(found.error||!found.data.user)throw Error('Cannot verify temporary account');
const user=found.data.user;
if(user.id!==id||user.app_metadata?.lda_hazard_qa!==true||!/^lda-hazard-qa-[a-f0-9-]+@example\.invalid$/.test(user.email||''))throw Error('Account scope mismatch');
const rows=await admin.from('lda_hazard_mock_attempts').delete().eq('owner_id',id).select('id');
if(rows.error)throw Error('Temporary attempt cleanup failed');
const deleted=await admin.auth.admin.deleteUser(id);
if(deleted.error)throw Error('Temporary account cleanup failed');
fs.mkdirSync('public',{recursive:true});
fs.writeFileSync('public/qa-cleanup.json',JSON.stringify({temporary_user:id,deleted:true,temporary_attempts_removed:rows.data.length,at:new Date().toISOString()}));
console.log('Removed only the temporary QA learner and its test attempts.');
