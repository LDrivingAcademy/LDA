import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const cli = 'C:/Users/Joshu/AppData/Roaming/npm/node_modules/vercel/dist/vc.js';
const response = execFileSync(process.execPath,[cli,'api','/v6/deployments/dpl_6M3WMPzqh9xhn3koei7dUy3y6kLU/files?teamId=team_tKtLsQdt8Omu58bqTcpTCt8r','--raw'],{encoding:'utf8',maxBuffer:20*1024*1024});
const tree=JSON.parse(response), entries=[];
function walk(nodes,prefix=''){for(const n of nodes){const p=prefix?`${prefix}/${n.name}`:n.name;if(n.children)walk(n.children,p);else if(n.type==='file')entries.push({path:p.replace(/^src\//,''),uid:n.uid});}}
walk(tree);
const selected=entries.filter(e=> /^(src\/|public\/|package(-lock)?\.json$|next.config|tsconfig|postcss|vercel\.json)/.test(e.path));
const changed=[],missing=[];
for(const e of selected){if(!fs.existsSync(e.path)){missing.push(e);continue;}const hash=createHash('sha1').update(fs.readFileSync(e.path)).digest('hex');if(hash!==e.uid)changed.push(e);}
const report={deployment:'dpl_6M3WMPzqh9xhn3koei7dUy3y6kLU',checked:selected.length,matching:selected.length-changed.length-missing.length,changed,missing};
fs.mkdirSync('.tmp/lda-live-source-audit',{recursive:true});
fs.writeFileSync('.tmp/lda-live-source-audit/tree.json',response);
fs.writeFileSync('.tmp/lda-live-source-audit/comparison.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
