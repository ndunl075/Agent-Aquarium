import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { normalizeClaudeEvent } from '@aquarium/adapters';
import { drainSpool, forwardEvent } from '@aquarium/cli';
import type { AquariumEventV1 } from '@aquarium/protocol';
import { startReceiver } from '../apps/desktop/src/main/receiver.js';
import { AquariumStore } from '../apps/desktop/src/main/store.js';
const cleanups:(()=>Promise<void>|void)[]=[];
afterEach(async()=>{for(const cleanup of cleanups.splice(0).reverse())await cleanup();});
async function directory(){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'aquarium-pipeline-'));cleanups.push(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}
function fact(sessionId:string,hook='SessionStart',extra:Record<string,unknown>={}):AquariumEventV1 {const event=normalizeClaudeEvent({session_id:sessionId,hook_event_name:hook,cwd:'C:\\same-repository',...extra});if(!event)throw new Error('Fixture rejected');return event;}
function post(port:number,token:string,body:unknown,headers:Record<string,string>={}):Promise<number> {return new Promise((resolve,reject)=>{const encoded=JSON.stringify(body),req=http.request({host:'127.0.0.1',port,path:'/events',method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...headers}},res=>{res.resume();resolve(res.statusCode??0);});req.on('error',reject);req.end(encoded);});}
describe('production event pipeline and durable state',()=>{
  it('creates five independent persisted fish in one repository with honest lifecycle and child identity',async()=>{
    const dir=await directory(),store=new AquariumStore(path.join(dir,'aquarium.db'));cleanups.push(()=>store.close());const receiver=await startReceiver(dir,e=>{store.accept(e);});cleanups.push(()=>receiver.close());
    for(let i=0;i<5;i++)expect(await forwardEvent(fact(`real-${i}`),{dataDir:dir,timeoutMs:1000})).toBe('delivered');
    expect(Object.values(store.state.agents)).toHaveLength(5);expect(new Set(Object.values(store.state.agents).map(a=>a.sessionId)).size).toBe(5);
    const completed=fact('real-0','Stop');completed.occurredAt+=10;expect(await forwardEvent(completed,{dataDir:dir,timeoutMs:1000})).toBe('delivered');
    const child=fact('real-1','SubagentStart',{agent_id:'real-child'});expect(await forwardEvent(child,{dataDir:dir,timeoutMs:1000})).toBe('delivered');
    const agents=Object.values(store.state.agents);expect(agents.find(a=>a.sessionId==='real-0')?.status).toBe('turn_done');expect(agents.find(a=>a.actorId==='real-child')?.parentKey).toBeDefined();expect(agents.every(a=>a.contextUsedPercent===null)).toBe(true);
    expect(await forwardEvent(completed,{dataDir:dir,timeoutMs:1000})).toBe('delivered');expect(Object.values(store.state.agents).find(a=>a.sessionId==='real-0')?.celebrationCount).toBe(1);
  });
  it('rejects browser requests, wrong credentials and private/unknown payload fields before persistence',async()=>{
    const dir=await directory(),store=new AquariumStore(path.join(dir,'aquarium.db'));cleanups.push(()=>store.close());const receiver=await startReceiver(dir,e=>{store.accept(e);});cleanups.push(()=>receiver.close());const event=fact('secure');
    expect(await post(receiver.port,receiver.token,event,{Origin:'https://malicious.example'})).toBe(403);expect(await post(receiver.port,'wrong-token',event)).toBe(401);expect(await post(receiver.port,receiver.token,{...event,prompt:'private'})).toBe(400);expect(await post(receiver.port,receiver.token,event,{'Content-Type':'text/plain'})).toBe(415);expect(Object.values(store.state.agents)).toHaveLength(0);
  });
  it('replays cold-start spool once and restores live sessions as stale after reopening SQLite',async()=>{
    const dir=await directory(),database=path.join(dir,'aquarium.db'),original=fact('cold-session');expect(await forwardEvent(original,{dataDir:dir})).toBe('queued');let store=new AquariumStore(database);let open=true;cleanups.push(()=>{if(open)store.close();});
    expect(await drainSpool(dir,e=>{store.accept(e);})).toBe(1);expect(await drainSpool(dir,e=>{store.accept(e);})).toBe(0);expect(store.state.sequence).toBe(1);store.close();open=false;store=new AquariumStore(database);open=true;
    expect(Object.values(store.state.agents)).toHaveLength(1);expect(Object.values(store.state.agents)[0]?.status).toBe('stale');expect(store.accept(original)).toBe(false);expect(store.state.sequence).toBe(1);
  });
});
