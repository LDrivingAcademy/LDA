import fs from 'node:fs';
import {createHash} from 'node:crypto';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_PROJECT_ID!=='prj_VN5AuDmkx5m2VRsEH7VADIfUtJI1')throw Error('LDA preview required');
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if(origin!=='https://vznbhgatsozzendikvvf.supabase.co'||!key)throw Error('LDA configuration unavailable');
const expected=JSON.parse(fs.readFileSync('expected-videos.json'));
if(expected.length!==15)throw Error('Expected fifteen files');
const results=[];
for(const v of expected){
 if(!/^lda-web-20260912-v1\/[a-f0-9]{24}\.mp4$/.test(v.object))throw Error('Unexpected object');
 const auth={apikey:key,Authorization:'Bearer '+key};
 const r=await fetch(origin+'/storage/v1/object/authenticated/lda-hazard-clips/'+v.object,{headers:auth,signal:AbortSignal.timeout(120000)});
 if(!r.ok||!r.body)throw Error('Private download failed: '+r.status);
 const hash=createHash('sha256');let bytes=0;
 for await(const chunk of r.body){hash.update(chunk);bytes+=chunk.length;}
 if(bytes!==v.bytes||hash.digest('hex')!==v.sha256)throw Error('Cloud file integrity failed');
 const signedResponse=await fetch(origin+'/storage/v1/object/sign/lda-hazard-clips/'+v.object,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:90}),signal:AbortSignal.timeout(20000)});
 if(!signedResponse.ok)throw Error('Signing failed');
 const signedData=await signedResponse.json();
 const signed=new URL(signedData.signedURL,origin+'/storage/v1');
 // The REST API returns a path beginning /object/sign, relative to storage/v1.
 const url=signedData.signedURL.startsWith('/object/')?origin+'/storage/v1'+signedData.signedURL:signed.href;
 if(new URL(url).origin!==origin)throw Error('Wrong signed origin');
 const range=await fetch(url,{headers:{Range:'bytes=0-31'},signal:AbortSignal.timeout(20000)});
 if(range.status!==206||(await range.arrayBuffer()).byteLength!==32)throw Error('Byte range unavailable');
 const anonymous=await fetch(origin+'/storage/v1/object/public/lda-hazard-clips/'+v.object,{method:'HEAD',signal:AbortSignal.timeout(20000)});
 if(anonymous.ok)throw Error('Private object publicly accessible');
 results.push({public_id:v.public_id,bytes,sha256:v.sha256,full_remote_hash_match:true,range_206:true,public_path_denied:true});
 console.log('Verified cloud video '+results.length+'/15');
}
fs.mkdirSync('public',{recursive:true});
fs.writeFileSync('public/integrity-report.json',JSON.stringify({checked_at:new Date().toISOString(),project:'vznbhgatsozzendikvvf',verified:results.length,bytes:results.reduce((n,r)=>n+r.bytes,0),results,learner_release_activated:false},null,2));
console.log('All fifteen private cloud copies match their local verified files.');
