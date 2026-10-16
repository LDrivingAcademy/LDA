// Loopback-only component/bundle boundary check. No auth bypass in the app,
// no cloud writes, no approved-release mutation, no real learner or clip data.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const root=process.cwd();
const folder=path.join(root,'.tmp/hazard-suite-check');
fs.mkdirSync(folder,{recursive:true});
const result=await build({
 entryPoints:[path.join(root,'scripts/hazard-browser-check/suite-entry.tsx')],
 bundle:true,outdir:folder,platform:'browser',format:'esm',splitting:true,
 jsx:'automatic',metafile:true,define:{'process.env.NODE_ENV':'"development"'},
 plugins:[{name:'fixture-next-dynamic',setup(b){
  b.onResolve({filter:/^next\/dynamic$/},()=>({path:'fixture-dynamic',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:
   'import React from "react"; export default function dynamic(load){const C=React.lazy(()=>load().then(v=>typeof v==="function"?{default:v}:v)); return function FixtureDynamic(props){return <React.Suspense fallback={<p>Loading component…</p>}><C {...props}/></React.Suspense>}}'}));
 }}]
});
fs.writeFileSync(path.join(folder,'bundle-metafile.json'),JSON.stringify(result.metafile,null,2));
const stylesheet=await postcss([tailwind()]).process(fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')});
fs.writeFileSync(path.join(folder,'style.css'),stylesheet.css);
const origin='http://127.0.0.1:4388';
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Theory Centre component boundary check</title><link rel="stylesheet" href="/style.css"></head><body style="font-family:system-ui;max-width:1280px;margin:16px auto;padding:12px"><p style="color:#b00000;font-weight:bold">LOCAL SOFTWARE CHECK — NOT A LIVE RELEASE</p><div id="root"></div><script>window.__consoleErrors=[];window.addEventListener("error",e=>window.__consoleErrors.push(e.message));window.addEventListener("unhandledrejection",e=>window.__consoleErrors.push(String(e.reason)));</script><script type="module" src="/suite-entry.js"></script></body></html>';
const server=http.createServer((req,res)=>{
 const json=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 if(req.headers.host!=='127.0.0.1:4388'||(req.headers.origin&&req.headers.origin!==origin))return json(403,{error:'Loopback fixture only'});
 const url=new URL(req.url,origin);
 if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});return res.end(html);}
 if(req.method==='GET'&&url.pathname==='/api/lda-hazard/sets')return json(200,{available:true,active_attempt_id:null,sets:[{set_id:'fixture-1',title:'Software fixture — not training clips',clip_count:14}]});
 if(req.method==='GET'&&/^\/[a-zA-Z0-9_-]+\.(js|css)$/.test(url.pathname)){
  const file=path.join(folder,url.pathname.slice(1));
  if(!fs.existsSync(file))return json(404,{error:'Missing fixture asset'});
  res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':'text/css','cache-control':'no-store'});
  return fs.createReadStream(file).pipe(res);
 }
 return json(404,{error:'No mutating fixture routes'});
});
server.listen(4388,'127.0.0.1',()=>console.log('Theory Centre component fixture: '+origin));
setTimeout(()=>server.close(),30*60*1000).unref();
