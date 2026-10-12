import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startReceiver } from './receiver';
const cleanup:Array<()=>Promise<unknown>>=[];
afterEach(async()=>{for(const fn of cleanup.splice(0).reverse())await fn();});
it('accepts only authenticated normalized events over ingest-only loopback',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'aquarium-rx-'));cleanup.push(()=>rm(dir,{recursive:true,force:true}));let count=0;
 const rx=await startReceiver(dir,()=>{count++;});cleanup.push(rx.close);
 const event={version:1,eventId:'one',provider:'custom',sessionId:'same-project-one',actorId:'main',kind:'session_started',occurredAt:Date.now()};
 const send=(body:unknown,headers:Record<string,string>={})=>fetch(`http://127.0.0.1:${rx.port}/events`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${rx.token}`,...headers},body:JSON.stringify(body)});
 expect((await send(event)).status).toBe(202);expect(count).toBe(1);
 expect((await send(event,{Authorization:'Bearer wrong'})).status).toBe(401);
 expect((await send(event,{Origin:'https://hostile.example'})).status).toBe(403);
 expect((await send({...event,prompt:'private'})).status).toBe(400);
 expect((await send({...event,eventId:'a'.repeat(17000)})).status).toBe(413);
 expect((await fetch(`http://127.0.0.1:${rx.port}/events`)).status).toBe(404);expect(count).toBe(1);
});
