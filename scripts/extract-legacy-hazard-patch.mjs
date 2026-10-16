// One-time AST-bounded mechanical move. Prints an apply_patch patch; never writes files.
import fs from 'node:fs';
import ts from 'typescript';
const file='src/components/theory-test-suite.tsx',dest='src/components/legacy-hazard-practice.tsx';
if(fs.existsSync(dest))throw Error('Existing extraction must be preserved');
const source=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=new Set(['HazardScene','HazardWindow','HazardScenario','WeakAreaRecommendation','HAZARD_PASS_MARK','HAZARD_TOTAL_MARKS','hazardScenarios','hazardCoachingPoints','hazardWeakAreaLabels','formatClipTime','getWindowScore','hasClickPattern','getHazardScores','buildWeakAreaRecommendations','motion','vehicleClass','RealisticHazardPracticeScene','HazardPracticeScene']);
const declarationName=node=>node.name?.text??(ts.isVariableStatement(node)?node.declarationList.declarations[0].name.getText(tree):null);
const globals=tree.statements.filter(n=>names.has(declarationName(n)));
if(globals.length!==names.size)throw Error('Expected every named legacy declaration');
const component=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='TheoryTestSuite');
const returnNode=component.body.statements.find(ts.isReturnStatement);
const containsLegacy=node=>{
 let found=false;function walk(n){if(ts.isIdentifier(n)&&/^(hazard|setHazard|selectedScenario|setSelectedScenario|isHazard|completedHazardClips|weakAreaRecommendations|getHazardScores|buildWeakAreaRecommendations|resetHazard|selectHazard|selectNextHazard|recordHazard|startHazard|reviewHazard)/.test(n.text))found=true;ts.forEachChild(n,walk);}walk(node);return found;
};
const moved=component.body.statements.filter(n=>n!==returnNode&&containsLegacy(n));
if(moved.length<20||moved.some(n=>n.getText(tree).includes('beginMockSession')))throw Error('Unexpected component extraction boundary');
let jsx;
function visit(n){if(ts.isJsxExpression(n)&&n.expression&&ts.isConditionalExpression(n.expression)&&n.expression.condition.getText(tree)==='activeView === "hazard" && !hazardVideoEnabled')jsx=n;ts.forEachChild(n,visit);}
visit(returnNode);if(!jsx)throw Error('Expected exact legacy UI branch');
const ui=jsx.expression.whenTrue.getText(tree);
const legacy='"use client";\n\nimport { useEffect, useMemo, useState } from "react";\nimport { ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, Clock3, ExternalLink, Flag, MousePointerClick, Play, RotateCcw, TrafficCone, type LucideIcon } from "lucide-react";\n\n// Retained only until the reviewed video release replaces the old practice mode.\n// Never import this answer-bearing legacy module from the new video player.\n'+globals.map(n=>n.getText(tree)).join('\n\n')+'\n\nexport function LegacyHazardPractice({ active }: { active: boolean }) {\n  const activeView = active ? "hazard" : "prepare";\n'+moved.map(n=>'  '+n.getText(tree)).join('\n\n')+'\n\n  return active ? '+ui+' : null;\n}\n';
const edits=[...globals,...moved].map(n=>({start:n.getFullStart(),end:n.end,text:''}));
edits.push({start:jsx.getStart(tree),end:jsx.end,text:'{!hazardVideoEnabled ? <LegacyHazardPractice active={activeView === "hazard"} /> : null}'});
const dynamic=tree.statements.find(n=>declarationName(n)==='LdaHazardVideoTest');
edits.push({start:dynamic.end,end:dynamic.end,text:'\nconst LegacyHazardPractice = dynamic(() => import("@/components/legacy-hazard-practice").then(module => module.LegacyHazardPractice), { ssr: false });'});
let revised=source;for(const edit of edits.sort((a,b)=>b.start-a.start))revised=revised.slice(0,edit.start)+edit.text+revised.slice(edit.end);
for(const output of [revised,legacy])if(ts.createSourceFile('result.tsx',output,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length)throw Error('Extracted syntax invalid');
const lines=s=>s.replaceAll('\r\n','\n').replace(/\n$/,'').split('\n');
process.stderr.write(JSON.stringify({moved_top_level:globals.map(declarationName),moved_component_statements:moved.length,new_root_lines:lines(revised).length,legacy_lines:lines(legacy).length})+'\n');
// Emit only bounded changed regions, never duplicate the huge unrelated quiz bank.
const oldLines=lines(source), lineOf=p=>tree.getLineAndCharacterOfPosition(p).line;
const lineEdits=[...globals,...moved].map(n=>({start:lineOf(n.getStart(tree)),end:lineOf(n.end)+1,add:[]}));
lineEdits.push({start:lineOf(jsx.getStart(tree)),end:lineOf(jsx.end)+1,add:['      {!hazardVideoEnabled ? <LegacyHazardPractice active={activeView === "hazard"} /> : null}']});
lineEdits.push({start:lineOf(dynamic.end)+1,end:lineOf(dynamic.end)+1,add:['const LegacyHazardPractice = dynamic(() => import("@/components/legacy-hazard-practice").then(module => module.LegacyHazardPractice), { ssr: false });']});
const groups=[];
for(const edit of lineEdits.sort((a,b)=>a.start-b.start)){
 const last=groups.at(-1);
 if(last&&edit.start<=last.at(-1).end+4)last.push(edit);else groups.push([edit]);
}
let patch='*** Begin Patch\n*** Update File: '+file+'\n';
for(const group of groups){
 patch+='@@\n';let at=Math.max(0,group[0].start-2);
 for(const edit of group){
  while(at<edit.start)patch+=' '+oldLines[at++]+'\n';
  while(at<edit.end)patch+='-'+oldLines[at++]+'\n';
  for(const line of edit.add)patch+='+'+line+'\n';
 }
 const end=Math.min(oldLines.length,group.at(-1).end+2);
 while(at<end)patch+=' '+oldLines[at++]+'\n';
}
patch+='*** Add File: '+dest+'\n'+lines(legacy).map(l=>'+'+l).join('\n')+'\n*** End Patch\n';
process.stdout.write(patch);
