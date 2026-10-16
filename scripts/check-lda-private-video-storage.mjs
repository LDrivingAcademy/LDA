// Scoped integration diagnostic. No real clips, users, release changes or secrets in reports.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const cloudBuild=process.argv.includes('--cloud-build');
if(cloudBuild&&(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_PROJECT_ID!=='prj_VN5AuDmkx5m2VRsEH7VADIfUtJI1'))throw Error('Only the expected isolated preview build may run the cloud diagnostic');
const master=cloudBuild?process.cwd():'C:/Users/Joshu/LDA Hazard Perception Production';
const scope=JSON.parse(fs.readFileSync(path.join(master,'production-scope.json')));
if(Date.now()+5*60e3>=Date.parse(scope.absolute_deadline_utc))throw Error('Deadline too close for storage diagnostic');
const env=process.env;
if(process.argv.includes('--configuration-presence-only')){
 for(const name of ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY']){
  const value=env[name]?.trim();console.log(JSON.stringify({name,present:Boolean(value),...(name.endsWith('URL')?{expected_project:value==='https://vznbhgatsozzendikvvf.supabase.co'}:{})}));
 }
 process.exit(0);
}
const url=env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=env.SUPABASE_SERVICE_ROLE_KEY?.trim(),publicKey=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if(url!=='https://vznbhgatsozzendikvvf.supabase.co'||!key||!publicKey)throw Error('Expected LDA production configuration unavailable');
const project=JSON.parse(fs.readFileSync(cloudBuild?'lda-project-identity.json':'.vercel/project.json'));
if(project.projectId!=='prj_VN5AuDmkx5m2VRsEH7VADIfUtJI1'||project.orgId!=='team_tKtLsQdt8Omu58bqTcpTCt8r')throw Error('Wrong deployment identity');
const boundedFetch=(input,init={})=>fetch(input,{...init,signal:AbortSignal.any([...(init.signal?[init.signal]:[]),AbortSignal.timeout(20000)])});
const options={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:boundedFetch}};
const admin=createClient(url,key,options),anon=createClient(url,publicKey,options),bucket='lda-hazard-clips';
const source=path.join(master,cloudBuild?'storage-check-fixture.mp4':'qc-reports/storage-check-fixture.mp4');
const bytes=fs.readFileSync(source);if(bytes.length>1e6||bytes.length<32)throw Error('Only tiny existing synthetic codec fixture permitted');
const sha=b=>createHash('sha256').update(b).digest('hex');
const name=`storage-check-${randomUUID()}.mp4`,object=`diagnostics/${name}`;
const reportPath=path.join(master,cloudBuild?'private-storage-integration-check.json':'qc-reports/private-storage-integration-check.json');
const report={checked_at:new Date().toISOString(),project_ref:'vznbhgatsozzendikvvf',bucket,object,fixture_bytes:bytes.length,fixture_sha256:sha(bytes),checks:{},created_bucket:false,uploaded:false,cleanup_verified:false,training_clips_uploaded:0,website_release_changed:false,credentials_changed:false};
const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
let stage='list-buckets',owned=false;
try{
 const listed=await admin.storage.listBuckets();if(listed.error)throw Error('list');
 let existing=listed.data.find(b=>b.id===bucket);
 if(!existing){stage='create-private-bucket';const created=await admin.storage.createBucket(bucket,{public:false,fileSizeLimit:50000000,allowedMimeTypes:['video/mp4']});if(created.error)throw Error('create');report.created_bucket=true;}
 stage='verify-private-bucket';const checked=await admin.storage.getBucket(bucket);if(checked.error||checked.data.public!==false||Number(checked.data.file_size_limit)!==50000000||checked.data.allowed_mime_types?.join(',')!=='video/mp4')throw Error('bucket configuration');
 report.checks.private_mp4_bucket_50MB=true;
 stage='verify-new-object-absent';const before=await admin.storage.from(bucket).list('diagnostics',{search:name});if(before.error||before.data.some(f=>f.name===name))throw Error('object identity');
 owned=true;save();stage='upload-synthetic';const upload=await admin.storage.from(bucket).upload(object,bytes,{contentType:'video/mp4',cacheControl:'0',upsert:false});if(upload.error)throw Error('upload');report.uploaded=true;
 stage='anonymous-download-denied';const anonymous=await anon.storage.from(bucket).download(object);if(!anonymous.error||anonymous.data)throw Error('anonymous access');report.checks.anonymous_download_denied=true;
 stage='public-path-denied';const publicResponse=await boundedFetch(`${url}/storage/v1/object/public/${bucket}/${object}`);await publicResponse.arrayBuffer();if(publicResponse.ok)throw Error('public access');report.checks.public_path_denied=true;report.public_path_status=publicResponse.status;
 stage='signed-url';const signed=await admin.storage.from(bucket).createSignedUrl(object,90);if(signed.error||!signed.data?.signedUrl)throw Error('sign');const signedUrl=new URL(signed.data.signedUrl);if(signedUrl.origin!==url)throw Error('signed origin');
 stage='signed-full-download';const full=await boundedFetch(signedUrl);const downloaded=Buffer.from(await full.arrayBuffer());if(!full.ok||sha(downloaded)!==sha(bytes))throw Error('download integrity');report.checks.signed_download_exact_hash=true;
 stage='signed-range';const ranged=await boundedFetch(signedUrl,{headers:{Range:'bytes=0-31','Accept-Encoding':'identity'}});const partial=Buffer.from(await ranged.arrayBuffer());if(ranged.status!==206||!partial.equals(bytes.subarray(0,32))||ranged.headers.get('content-range')!==`bytes 0-31/${bytes.length}`)throw Error('range integrity');report.checks.range_206_exact_bytes=true;
 stage='signed-head';const head=await boundedFetch(signedUrl,{method:'HEAD'});if(!head.ok||Number(head.headers.get('content-length'))!==bytes.length||(await head.arrayBuffer()).byteLength!==0)throw Error('head');report.checks.head_exact_length_no_body=true;
 stage='complete';
}catch{report.failed_stage=stage;process.exitCode=1;}
finally{
 if(owned){
  try{const removed=await admin.storage.from(bucket).remove([object]);if(removed.error)throw Error('remove');const after=await admin.storage.from(bucket).list('diagnostics',{search:name});if(after.error||after.data.some(f=>f.name===name))throw Error('cleanup verification');report.cleanup_verified=true;}
  catch{report.cleanup_required=true;process.exitCode=1;}
 }
 report.passed=stage==='complete'&&report.cleanup_verified;report.remaining=['Authenticated learner owner/current-clip API integration','Actual approved clips and final delivery size/egress checks'];save();console.log(JSON.stringify(report,null,2));
 if(cloudBuild){fs.mkdirSync('public',{recursive:true});fs.writeFileSync('public/index.html','<!doctype html><title>LDA private storage diagnostic</title><p>Private storage diagnostic only. Not the LDA website or training library.</p>');}
}
