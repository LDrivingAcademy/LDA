import fs from 'node:fs';
const source='C:/Users/Joshu/LDA Hazard Perception Production/server/';
for(const file of ['scoring.mjs','mock-tests.mjs','persistent-mocks.mjs']){
 const code=fs.readFileSync(source+file,'utf8').replaceAll('\r\n','\n');
 fs.writeFileSync('src/lib/lda-hazard/server/'+file,"import 'server-only';\n"+code);
}
console.log('Synced the canonical hazard engine with the website server-only boundary.');
