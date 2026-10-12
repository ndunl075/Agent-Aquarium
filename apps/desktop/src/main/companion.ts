import { constants } from 'node:fs';
import { access, chmod, copyFile, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';

interface RuntimeManifest {version:string;platform:NodeJS.Platform;arch:string}
function parseManifest(raw:string):RuntimeManifest {
  if(Buffer.byteLength(raw)>4096)throw new Error('Invalid companion runtime manifest');
  const value:unknown=JSON.parse(raw);
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('Invalid companion runtime manifest');
  const manifest=value as Record<string,unknown>;
  if(typeof manifest.version!=='string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}(?:-[a-zA-Z0-9][a-zA-Z0-9.-]{0,40})?$/.test(manifest.version)
    || typeof manifest.platform!=='string' || !['win32','darwin','linux'].includes(manifest.platform)
    || typeof manifest.arch!=='string' || !/^[a-z0-9]{1,16}$/.test(manifest.arch)
    || manifest.platform!==process.platform || manifest.arch!==process.arch)throw new Error('Companion runtime does not match this machine');
  return {version:manifest.version,platform:manifest.platform as NodeJS.Platform,arch:manifest.arch};
}
async function exists(file:string):Promise<boolean> {
  try{await access(file,constants.F_OK);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}
}
/** Publish a complete file only; leave older immutable companions usable by installed hooks. */
async function copyOnce(source:string,destination:string,executable=false):Promise<void> {
  if(await exists(destination)){if(executable)await chmod(destination,0o755);return;}
  const temporary=`${destination}.${randomUUID()}.tmp`;
  try{
    await copyFile(source,temporary,constants.COPYFILE_EXCL);
    await chmod(temporary,executable?0o755:0o600);
    // The Electron singleton ordinarily serializes staging. This recheck also
    // avoids replacing an existing executable if another stager just finished.
    if(await exists(destination))return;
    try{await rename(temporary,destination);}catch(error){if(!(await exists(destination)))throw error;}
  }finally{await rm(temporary,{force:true});}
}

/** Portable launch extraction directories are temporary; hook commands must be durable. */
export async function stagePortableCompanion(sourceDir:string,dataDir:string):Promise<{runtime:string;script:string}> {
  const manifestFile=join(sourceDir,'runtime.json');
  if((await stat(manifestFile)).size>4096)throw new Error('Invalid companion runtime manifest');
  const manifest=parseManifest(await readFile(manifestFile,'utf8'));
  const sourceRuntime=join(sourceDir,manifest.platform==='win32'?'node.exe':'node');
  const sourceScript=join(sourceDir,'bin.cjs');
  const sourceLicense=join(sourceDir,'LICENSE.txt');
  // Validate all inputs before creating a usable partial installation.
  for(const file of [sourceRuntime,sourceScript,sourceLicense])if(!(await stat(file)).isFile())throw new Error('Incomplete companion bundle');
  const digest=createHash('sha256').update(await readFile(sourceScript)).digest('hex');
  const directory=resolve(dataDir,'companion');await mkdir(directory,{recursive:true,mode:0o700});
  const stem=`node-v${manifest.version}-${manifest.platform}-${manifest.arch}`;
  const runtime=join(directory,`${stem}${manifest.platform==='win32'?'.exe':''}`);
  const script=join(directory,`bin-${digest}.cjs`);
  await copyOnce(sourceLicense,join(directory,`${stem}.LICENSE.txt`));
  await copyOnce(sourceRuntime,runtime,manifest.platform!=='win32');
  await copyOnce(sourceScript,script);
  return {runtime,script};
}
