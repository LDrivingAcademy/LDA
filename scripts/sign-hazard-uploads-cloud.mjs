import fs from 'node:fs';
import {randomBytes,createCipheriv,publicEncrypt,constants} from 'node:crypto';
if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_PROJECT_ID!=='prj_VN5AuDmkx5m2VRsEH7VADIfUtJI1')throw Error('Expected LDA preview environment required');
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const credential=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if(origin!=='https://vznbhgatsozzendikvvf.supabase.co'||!credential)throw Error('LDA storage configuration unavailable');
const objects=JSON.parse(fs.readFileSync('objects.json'));
if(objects.length!==15||!objects.every(x=>/^lda-web-20260912-v1\/[a-f0-9]{24}\.mp4$/.test(x.object)))throw Error('Invalid upload scope');
const grants=[];
for(const item of objects){
 const r=await fetch(origin+'/storage/v1/object/upload/sign/lda-hazard-clips/'+item.object,{method:'POST',headers:{apikey:credential,Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Upload grant creation failed: '+r.status);
 const data=await r.json();
 const relative=data.url||data.signedURL||data.signedUrl;
 const signed=new URL(relative,origin+'/storage/v1/');
 const token=data.token||signed.searchParams.get('token');
 if(!token)throw Error('No scoped upload token');
 grants.push({...item,token});
}
const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
const encrypted=Buffer.concat([cipher.update(JSON.stringify({created_at:new Date().toISOString(),grants})),cipher.final()]);
const wrapped=publicEncrypt({key:fs.readFileSync('upload-public.pem'),padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key);
fs.mkdirSync('public',{recursive:true});
fs.writeFileSync('public/encrypted-upload-grants.json',JSON.stringify({key:wrapped.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),payload:encrypted.toString('base64')}));
console.log('Fifteen scoped, expiring upload grants encrypted for the local uploader. No service credentials exported.');
