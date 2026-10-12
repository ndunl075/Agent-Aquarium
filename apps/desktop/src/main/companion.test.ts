import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stagePortableCompanion } from './companion';

const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'aquarium-companion-'));roots.push(root);
  const source=join(root,'temporary extraction');const data=join(root,'private data');await mkdir(source);
  const manifest={version:'22.23.2',platform:process.platform,arch:process.arch};
  await writeFile(join(source,'runtime.json'),JSON.stringify(manifest));
  await writeFile(join(source,process.platform==='win32'?'node.exe':'node'),'fake runtime');
  await writeFile(join(source,'bin.cjs'),'console.log("first");');
  await writeFile(join(source,'LICENSE.txt'),'MIT runtime fixture license');
  return {root,source,data,manifest};
}
describe('durable portable companion staging',()=>{
  it('keeps runtime, CLI, and license usable after extraction disappears',async()=>{
    const f=await fixture();const result=await stagePortableCompanion(f.source,f.data);
    await rm(f.source,{recursive:true,force:true});
    expect(await readFile(result.runtime,'utf8')).toBe('fake runtime');
    expect(await readFile(result.script,'utf8')).toBe('console.log("first");');
    const license=(await readdir(join(f.data,'companion'))).find(file=>file.endsWith('.LICENSE.txt'))!;
    expect(await readFile(join(f.data,'companion',license),'utf8')).toBe('MIT runtime fixture license');
    if(process.platform!=='win32')expect((await stat(result.runtime)).mode&0o777).toBe(0o755);
  });
  it('is idempotent and preserves existing configured paths after a CLI update',async()=>{
    const f=await fixture();const first=await stagePortableCompanion(f.source,f.data);
    expect(await stagePortableCompanion(f.source,f.data)).toEqual(first);
    await writeFile(join(f.source,'bin.cjs'),'console.log("second");');
    const second=await stagePortableCompanion(f.source,f.data);
    expect(second.runtime).toBe(first.runtime);expect(second.script).not.toBe(first.script);
    expect(await readFile(first.script,'utf8')).toBe('console.log("first");');
    expect(await readFile(second.script,'utf8')).toBe('console.log("second");');
    expect((await readdir(join(f.data,'companion'))).some(file=>file.endsWith('.tmp'))).toBe(false);
  });
  it('preserves previous versioned runtimes when upgrading',async()=>{
    const f=await fixture();const first=await stagePortableCompanion(f.source,f.data);
    await writeFile(join(f.source,'runtime.json'),JSON.stringify({...f.manifest,version:'22.24.0'}));
    await writeFile(join(f.source,process.platform==='win32'?'node.exe':'node'),'updated runtime');
    const next=await stagePortableCompanion(f.source,f.data);
    expect(next.runtime).not.toBe(first.runtime);
    expect(await readFile(first.runtime,'utf8')).toBe('fake runtime');
    expect(await readFile(next.runtime,'utf8')).toBe('updated runtime');
  });
  it.each([{version:'../../escape'},{version:'22.1.1/evil'},{platform:'../win32'},{arch:'../x64'},{version:null},{platform:process.platform==='win32'?'linux':'win32'}])('refuses unsafe or mismatched manifest %j',async(patch)=>{
    const f=await fixture();await writeFile(join(f.source,'runtime.json'),JSON.stringify({...f.manifest,...patch}));
    await expect(stagePortableCompanion(f.source,f.data)).rejects.toThrow();
    await expect(stat(join(f.data,'companion'))).rejects.toThrow();
  });
});
