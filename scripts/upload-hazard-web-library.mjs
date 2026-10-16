import fs from 'node:fs';
import path from 'node:path';
import {privateDecrypt,createDecipheriv,createHash,constants} from 'node:crypto';
import {parseEnv} from 'node:util';
const origin='https://vznbhgatsozzendikvvf.storage.supabase.co';
const endpoint=origin+'/storage/v1/upload/resumable';
const root='C:/Users/Joshu/LDA Hazard Perception Production/final-renders/web-library-v1';
const bridge=process.argv[2];
if(bridge!=='https://lda-joj9cci35-ldrivingacademys-projects.vercel.app')throw Error('Unexpected grant deployment');
const r=await fetch(bridge+'/encrypted-upload-grants.json',{signal:AbortSignal.timeout(30000)});
if(!r.ok)throw Error('Cannot retrieve encrypted upload grants: '+r.status);
const encrypted=await r.json();
const key=privateDecrypt({key:fs.readFileSync('.tmp/lda-hazard-upload-private-v1/key.pem'),padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(encrypted.key,'base64'));
const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(encrypted.iv,'base64'));
decipher.setAuthTag(Buffer.from(encrypted.tag,'base64'));
const grants=JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.payload,'base64')),decipher.final()]).toString()).grants;
const env=parseEnv(fs.readFileSync('.env.codex.supabase-check.local','utf8'));
const apikey=env.SUPABASE_PUBLISHABLE_KEY;
if(!apikey||grants.length!==15)throw Error('Upload configuration incomplete');
const reports=[];
for(const g of grants){
 const dir=path.join(root,g.clip_id),verification=path.join(dir,'verification.json');
 if(!fs.existsSync(verification)){console.log('WAITING FOR ENCODE '+g.clip_id);break;}
 const v=JSON.parse(fs.readFileSync(verification)), bytes=fs.readFileSync(v.video);
 if(createHash('sha256').update(bytes).digest('hex')!==v.sha256||bytes.length>=50000000)throw Error('Invalid verified file');
 const reportFile=path.join(dir,'upload.json');
 if(fs.existsSync(reportFile)){const prior=JSON.parse(fs.readFileSync(reportFile));if(prior.sha256!==v.sha256||prior.object!==g.object)throw Error('Existing upload mismatch');reports.push(prior);continue;}
 // The TUS signed-grant flow returned an RLS rejection. Use the documented
 // signed PUT for these bounded <50MB files; do not weaken bucket policies.
 const target=new URL('https://vznbhgatsozzendikvvf.supabase.co/storage/v1/object/upload/sign/lda-hazard-clips/'+g.object);
 target.searchParams.set('token',g.token);
 const uploaded=await fetch(target,{method:'PUT',redirect:'error',headers:{apikey,'Content-Type':'video/mp4','Cache-Control':'max-age=3600','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(180000)});
 if(!uploaded.ok){const detail=(await uploaded.text()).replace(/eyJ[A-Za-z0-9_.-]+/g,'[token]').slice(0,300);throw Error('Signed upload rejected: '+uploaded.status+' '+g.clip_id+' '+detail);}
 const report={clip_id:g.clip_id,object:g.object,public_id:g.public_id,sha256:v.sha256,bytes:bytes.length,uploaded_at:new Date().toISOString(),signed_put_completed:true,upsert:false,remote_download_hash_verified:false};
 fs.writeFileSync(reportFile,JSON.stringify(report,null,2),{flag:'wx'});reports.push(report);
 console.log('UPLOADED '+g.clip_id+' '+bytes.length+' bytes');
}
fs.writeFileSync(path.join(root,'upload-index.json'),JSON.stringify(reports,null,2));
console.log('Verified upload records: '+reports.length+'/15');
