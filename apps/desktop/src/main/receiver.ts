import { createServer, type Server } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { eventSchema, type AquariumEventV1 } from '@aquarium/protocol';

export async function startReceiver(dataDir:string, consume:(event:AquariumEventV1)=>void):Promise<{server:Server;port:number;token:string;close:()=>Promise<void>}> {
  await mkdir(dataDir,{recursive:true,mode:0o700});
  const token=randomBytes(32).toString('hex');
  const server=createServer((request,response)=>{
    const reply=(code:number)=>{response.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify({ok:code===202}));};
    if(request.headers.origin || request.headers['sec-fetch-site']) return reply(403);
    if(request.method!=='POST'||request.url!=='/events') return reply(404);
    if(request.headers['content-type']?.split(';')[0].trim()!=='application/json') return reply(415);
    const actual=Buffer.from(request.headers.authorization??'');const expected=Buffer.from(`Bearer ${token}`);
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected)) return reply(401);
    if(Number(request.headers['content-length']??0)>16384) return reply(413);
    const chunks:Buffer[]=[];let size=0;let rejected=false;
    request.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>16384){if(!rejected)reply(413);rejected=true;request.resume();}else if(!rejected)chunks.push(chunk);});
    request.on('end',()=>{if(rejected)return;try{const parsed=eventSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));if(!parsed.success)return reply(400);consume(parsed.data);reply(202);}catch{return reply(400);}});
    request.on('error',()=>{if(!response.headersSent)reply(400);});
  });
  server.requestTimeout=2000;server.headersTimeout=2000;server.timeout=2000;
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve());});
  const address=server.address();if(!address||typeof address==='string')throw new Error('Listener failed');
  const discovery=join(dataDir,'connection.json');const temporary=join(dataDir,`.connection-${process.pid}.tmp`);
  await writeFile(temporary,JSON.stringify({version:1,port:address.port,token}),{mode:0o600});await rename(temporary,discovery);
  return {server,port:address.port,token,close:async()=>{await rm(discovery,{force:true});server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
