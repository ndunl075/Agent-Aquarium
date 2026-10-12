import { execFileSync } from 'node:child_process';
import { readFile,writeFile,readdir } from 'node:fs/promises';
import { join } from 'node:path';
const executable=process.platform==='win32'?'pnpm.cmd':'pnpm';
const inventory=JSON.parse(execFileSync(executable,['licenses','list','--prod','--json'],{encoding:'utf8',shell:process.platform==='win32',windowsHide:true,maxBuffer:8*1024*1024}));
let output='# Third-party notices\n\nGenerated from the locked production dependency inventory. Electron also ships its LICENSE and Chromium notices with the desktop runtime. The standalone Node companion runtime includes its complete license and bundled-library notices in resources/cli/LICENSE.txt (source: docs/licenses/node-LICENSE.txt). Aquarium artwork is original and distributed under the project MIT license.\n';
for(const [license,packages]of Object.entries(inventory)){
 if(!['MIT','BSD-3-Clause','ISC','Apache-2.0','BSD-2-Clause'].includes(license))throw new Error(`Review required for dependency license: ${license}`);
 for(const pkg of packages){
  output+=`\n## ${pkg.name} ${pkg.versions.join(', ')} (${license})\n\n`;
  const directory=pkg.paths[0];const files=(await readdir(directory)).filter(name=>/^licen[cs]e(?:[.-]|$)|^copying(?:[.-]|$)/i.test(name));
  if(!files.length&&pkg.name==='@pixi/colord'){
    output+='License omitted from the npm package; restored from its declared upstream repository: https://github.com/omgovich/colord/blob/master/LICENSE.md\n\n```text\n'+(await readFile('docs/licenses/pixi-colord-MIT.txt','utf8')).trim()+'\n```\n';continue;
  }
  if(!files.length)throw new Error(`License text missing for ${pkg.name}`);
  for(const file of files){try{output+='```text\n'+(await readFile(join(directory,file),'utf8')).trim()+'\n```\n';}catch{throw new Error(`Cannot read license text for ${pkg.name}`);}}
 }
}
await writeFile('docs/THIRD_PARTY_NOTICES.md',output);console.log('Production license inventory reviewed and notices generated.');
