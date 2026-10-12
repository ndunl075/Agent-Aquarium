import { mkdir,copyFile,chmod } from 'node:fs/promises';
import { join } from 'node:path';
export async function prepareCompanion(){
 if(process.versions.node!=='22.23.2')throw new Error('Build with Node 22.23.2 from .node-version so the bundled runtime and redistribution notices match.');
 const directory='apps/desktop/dist/cli';await mkdir(directory,{recursive:true});
 const runtime=join(directory,process.platform==='win32'?'node.exe':'node');
 await copyFile(process.execPath,runtime);await chmod(runtime,0o755);
 await copyFile('docs/licenses/node-LICENSE.txt',join(directory,'LICENSE.txt'));
}
