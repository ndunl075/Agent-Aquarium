import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { drainSpool, installClaude, uninstallClaude } from '@aquarium/cli';

let root:string, binary:string;
beforeAll(async()=>{
  root=await fs.mkdtemp(path.join(os.tmpdir(),'aquarium-cli-acceptance-'));binary=path.join(root,'cli.cjs');
  await build({entryPoints:[path.resolve('packages/cli/src/bin.ts')],outfile:binary,bundle:true,platform:'node',format:'cjs',alias:Object.fromEntries(['protocol','adapters','cli'].map(name=>[`@aquarium/${name}`,path.resolve(`packages/${name}/src/index.ts`)]))});
});
afterAll(async()=>{if(root)await fs.rm(root,{recursive:true,force:true});});
async function run(args:string[],input:string|undefined,dir:string,extraEnv:NodeJS.ProcessEnv={}):Promise<{code:number|null;stdout:string;stderr:string;elapsed:number}> {
  await fs.mkdir(dir,{recursive:true});const started=Date.now();
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[binary,...args],{windowsHide:true,env:{...process.env,AGENT_AQUARIUM_DATA_DIR:dir,CLAUDE_CONFIG_DIR:dir,...extraEnv},stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(new Error('CLI exceeded acceptance deadline'));},5000);
    child.stdout.on('data',b=>stdout+=b.toString());child.stderr.on('data',b=>stderr+=b.toString());child.stdin.on('error',()=>{});
    child.once('error',reject);child.once('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr,elapsed:Date.now()-started});});
    if(input!==undefined)child.stdin.end(input);
  });
}
describe('actual companion executable',()=>{
  it.each(['{broken',JSON.stringify({hook_event_name:'PreToolUse',session_id:'s',tool_input:{command:'private-secret'},tool_name:'private-secret'}),'x'.repeat(1024*1024+1)])('fails open silently for malformed/private/oversized hook input (%#)',async input=>{
    const result=await run(['hook','claude'],input,path.join(root,`invalid-${input.length}`));expect(result.code).toBe(0);expect(result.stdout).toBe('');expect(result.stderr).toBe('');expect(result.elapsed).toBeLessThan(3000);
  });
  it('has an internal deadline when the provider never closes stdin',async()=>{const result=await run(['hook','claude'],undefined,path.join(root,'no-eof'));expect(result).toMatchObject({code:0,stdout:'',stderr:''});expect(result.elapsed).toBeLessThan(3000);});
  it('generates shell-free packaged hooks with literal executable arguments and removes them reversibly',async()=>{
    const dir=path.join(root,'literal-path'),settingsPath=path.join(dir,'settings.json'),special=path.join(dir,"cli $data %VAR% 'quote'.cjs");await fs.mkdir(dir,{recursive:true});await fs.copyFile(binary,special);
    expect((await installClaude({settingsPath,executable:process.execPath,args:[special]})).ok).toBe(true);
    const settings=JSON.parse(await fs.readFile(settingsPath,'utf8')),handler=settings.hooks.SessionStart[0].hooks[0];expect(handler.command).toBe(process.execPath);expect(handler.args).toEqual([special,'hook','claude']);
    const result=await new Promise<{code:number|null;output:string}>(resolve=>{const child=spawn(handler.command,handler.args,{windowsHide:true,env:{...process.env,AGENT_AQUARIUM_DATA_DIR:dir},stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);child.on('close',code=>resolve({code,output}));child.stdin.end(JSON.stringify({session_id:'literal-path-session',hook_event_name:'SessionStart'}));});
    expect(result).toEqual({code:0,output:''});expect(await drainSpool(dir,()=>{})).toBe(1);expect((await uninstallClaude({settingsPath})).ok).toBe(true);expect(JSON.parse(await fs.readFile(settingsPath,'utf8'))).toEqual({});
  });
  it('forwards independent session hooks to app-down spool without raw private data',async()=>{
    const dir=path.join(root,'app-down');for(let i=0;i<5;i++)expect((await run(['hook','claude'],JSON.stringify({hook_event_name:'SessionStart',session_id:`real-${i}`,cwd:'C:\\private-parent\\one-project',prompt:'private-secret',transcript_path:'private-secret'}),dir)).code).toBe(0);
    const events:unknown[]=[];expect(await drainSpool(dir,e=>{events.push(e);})).toBe(5);expect(JSON.stringify(events)).not.toMatch(/private-secret|private-parent|transcript_path|prompt/);expect(new Set(events.map((e:any)=>e.sessionId)).size).toBe(5);
  });
  it('previews installation and preserves the existing status-line output through opt-in and uninstall',async()=>{
    const dir=path.join(root,'settings'), settings=path.join(dir,'settings.json'),original=path.join(dir,'original.cjs');await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(original,"let input='';process.stdin.on('data',x=>input+=x);process.stdin.on('end',()=>{JSON.parse(input);process.stdout.write('my exact status\\n');});");
    const initial={theme:'keep',hooks:{Stop:[{hooks:[{type:'command',command:'echo existing'}]}]},statusLine:{type:'command',command:`"${process.execPath}" "${original}"`}};await fs.writeFile(settings,JSON.stringify(initial));
    expect((await run(['install','claude'],undefined,dir)).code).toBe(0);expect(JSON.parse(await fs.readFile(settings,'utf8'))).toEqual(initial);
    expect((await run(['install','claude','--yes','--status-line'],undefined,dir)).code).toBe(0);
    const status=await run(['status-bridge','claude'],JSON.stringify({session_id:'metrics',context_window:{used_percentage:null}}),dir);expect(status).toMatchObject({code:0,stdout:'my exact status\n',stderr:''});
    const events:any[]=[];await drainSpool(dir,e=>{events.push(e);});expect(events).toHaveLength(1);expect(events[0]).toMatchObject({kind:'context_updated',contextUsedPercent:null});
    expect((await run(['uninstall','claude'],undefined,dir)).code).toBe(0);expect(JSON.parse(await fs.readFile(settings,'utf8'))).toEqual(initial);
  });
});
