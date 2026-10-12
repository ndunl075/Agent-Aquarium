import { beforeAll, afterAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { drainSpool } from './transport.js';
import { installStatusBridge, statusBridgeCommand } from './status.js';
let root:string,binary:string;
beforeAll(async()=>{
  root=await fs.mkdtemp(path.join(os.tmpdir(),'aquarium-runtime-'));
  binary=path.join(root,"source $variable %MISSING% 'quote' `tick`.cjs");
  await build({entryPoints:[path.resolve('packages/cli/src/bin.ts')],outfile:binary,bundle:true,platform:'node',format:'cjs',alias:Object.fromEntries(['protocol','adapters','cli'].map(name=>[`@aquarium/${name}`,path.resolve(`packages/${name}/src/index.ts`)]))});
});
afterAll(async()=>{if(root)await fs.rm(root,{recursive:true,force:true});});
async function execute(command:string,args:string[],dir:string,input='',shell=false):Promise<{code:number|null;stdout:string;stderr:string}> {
  await fs.mkdir(dir,{recursive:true});
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{shell,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,AGENT_AQUARIUM_DATA_DIR:dir,CLAUDE_CONFIG_DIR:dir}});
    const output:Buffer[]=[],errors:Buffer[]=[];const timer=setTimeout(()=>{child.kill();reject(new Error('Runtime launch timeout'));},6000);
    child.stdout.on('data',chunk=>output.push(chunk));child.stderr.on('data',chunk=>errors.push(chunk));child.stdin.on('error',()=>{});child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('close',code=>{clearTimeout(timer);resolve({code,stdout:Buffer.concat(output).toString('utf8'),stderr:Buffer.concat(errors).toString('utf8')});});child.stdin.end(input);
  });
}
it('source CLI preview and installation target the running Node and literal script instead of a global command',async()=>{
  const dir=path.join(root,'hook-settings'),settingsPath=path.join(dir,'settings.json');
  const preview=await execute(process.execPath,[binary,'install','claude'],dir);expect(preview.code).toBe(0);expect(await fs.stat(settingsPath).catch(()=>null)).toBeNull();
  const json=JSON.parse(preview.stdout.slice(preview.stdout.indexOf('{'),preview.stdout.lastIndexOf('}')+1));expect(json.hooks.SessionStart[0].hooks[0]).toMatchObject({command:process.execPath,args:[binary,'hook','claude']});
  expect((await execute(process.execPath,[binary,'install','claude','--yes'],dir)).code).toBe(0);
  const settings=JSON.parse(await fs.readFile(settingsPath,'utf8')),handler=settings.hooks.SessionStart[0].hooks[0];
  expect(await execute(handler.command,handler.args,dir,JSON.stringify({session_id:'source-session',hook_event_name:'SessionStart'}))).toEqual({code:0,stdout:'',stderr:''});
  const events:any[]=[];expect(await drainSpool(dir,e=>{events.push(e);})).toBe(1);expect(events[0]).toMatchObject({sessionId:'source-session',kind:'session_started'});
});
it('installed source status command executes literal special paths and preserves original stdin and stdout bytes',async()=>{
  const dir=path.join(root,'status-settings'),settingsPath=path.join(dir,'settings.json'),originalScript=path.join(dir,'original.cjs');await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(originalScript,"let s='';process.stdin.on('data',b=>s+=b);process.stdin.on('end',()=>{const p=JSON.parse(s);process.stdout.write(p.marker==='original-input'?'reef 🐠\\nexact\\toutput':'bad stdin');});");
  const originalCommand=process.platform==='win32'?`"${process.execPath}" "${originalScript}"`:[process.execPath,originalScript].map(v=>`'${v.replace(/'/g,"'\\''")}'`).join(' ');
  const initial={statusLine:{type:'command',command:originalCommand},theme:'preserve'};await fs.writeFile(settingsPath,JSON.stringify(initial));
  expect((await execute(process.execPath,[binary,'install','claude','--yes','--status-line'],dir)).code).toBe(0);
  const settings=JSON.parse(await fs.readFile(settingsPath,'utf8'));expect(settings.statusLine.command).not.toBe('agent-aquarium status-bridge claude');
  const result=await execute(settings.statusLine.command,[],dir,JSON.stringify({session_id:'source-context',marker:'original-input',context_window:{used_percentage:23}}),true);
  expect(result).toEqual({code:0,stdout:'reef 🐠\nexact\toutput',stderr:''});const events:any[]=[];expect(await drainSpool(dir,e=>{events.push(e);})).toBe(1);expect(events[0]).toMatchObject({kind:'context_updated',contextUsedPercent:23});
  expect((await execute(process.execPath,[binary,'uninstall','claude'],dir)).code).toBe(0);expect(JSON.parse(await fs.readFile(settingsPath,'utf8'))).toEqual(initial);
});
it('refuses to wrap an existing encoded bridge when its sidecar is missing',async()=>{
  const dir=path.join(root,'no-recursion'),settingsPath=path.join(dir,'settings.json');await fs.mkdir(dir,{recursive:true});
  const wrapper=statusBridgeCommand({executable:process.execPath,args:[binary]});await fs.writeFile(settingsPath,JSON.stringify({statusLine:{type:'command',command:wrapper}}));expect((await installStatusBridge({settingsPath,executable:process.execPath,args:[binary]})).ok).toBe(false);expect(JSON.parse(await fs.readFile(settingsPath,'utf8')).statusLine.command).toBe(wrapper);
});
