import { beforeAll, afterAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { drainSpool } from './transport.js';
let dir:string,binary:string;
beforeAll(async()=>{dir=await fs.mkdtemp(path.join(os.tmpdir(),'aquarium-codex-'));binary=path.join(dir,'cli.cjs');await build({entryPoints:[path.resolve('packages/cli/src/bin.ts')],outfile:binary,bundle:true,platform:'node',format:'cjs',alias:Object.fromEntries(['protocol','adapters','cli'].map(name=>[`@aquarium/${name}`,path.resolve(`packages/${name}/src/index.ts`)]))});});
afterAll(async()=>{if(dir)await fs.rm(dir,{recursive:true,force:true});});
function notify(payload:string):Promise<{code:number|null;output:string}>{return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[binary,'hook','codex',payload],{windowsHide:true,env:{...process.env,AGENT_AQUARIUM_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.once('error',reject);const timer=setTimeout(()=>{child.kill();reject(new Error('Notifier deadline exceeded'));},4000);child.once('close',code=>{clearTimeout(timer);resolve({code,output});});});}
it('accepts the documented single JSON argv payload silently and persists only completion metadata',async()=>{expect(await notify(JSON.stringify({type:'agent-turn-complete','thread-id':'actual-thread','turn-id':'actual-turn','input-messages':['private-input'],'last-assistant-message':'private-output',cwd:'/private-parent/repo'}))).toEqual({code:0,output:''});const events:any[]=[];expect(await drainSpool(dir,e=>{events.push(e);})).toBe(1);expect(events[0]).toMatchObject({provider:'codex',kind:'turn_completed',sessionId:'actual-thread'});expect(JSON.stringify(events)).not.toMatch(/private-input|private-output|private-parent/);});
it('malformed Codex notification JSON fails open without spool output',async()=>{expect(await notify('{broken')).toEqual({code:0,output:''});expect(await drainSpool(dir,()=>{})).toBe(0);});
