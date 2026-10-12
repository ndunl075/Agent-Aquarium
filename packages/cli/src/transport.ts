import { promises as fs } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { aquariumEventSchema, type AquariumEventV1 } from '@aquarium/protocol';
import { aquariumDataDir } from './paths.js';
const MAX_BYTES = 10 * 1024 * 1024, MAX_EVENTS = 1000, MAX_EVENT_BYTES = 16384;
const priority = new Set(['attention_required', 'turn_completed', 'turn_failed', 'session_ended', 'subagent_stopped']);
async function boundedRead(file: string, limit: number): Promise<string> { const h = await fs.open(file, 'r'); try { const b = Buffer.alloc(limit + 1); const {bytesRead} = await h.read(b, 0, b.length, 0); if (bytesRead > limit) throw new Error('File too large'); return b.subarray(0, bytesRead).toString('utf8'); } finally { await h.close(); } }
export async function readConnection(dataDir = aquariumDataDir()): Promise<{version:1;port:number;token:string}> {
  const c = JSON.parse(await boundedRead(path.join(dataDir, 'connection.json'), 4096));
  if (c.version !== 1 || !Number.isInteger(c.port) || c.port < 1 || c.port > 65535 || typeof c.token !== 'string' || c.token.length < 16 || c.token.length > 1024 || /[\r\n]/.test(c.token)) throw new Error('Invalid discovery');
  return c;
}
async function deliver(event: AquariumEventV1, dataDir: string, timeoutMs: number): Promise<void> {
  const c = await readConnection(dataDir), body = JSON.stringify(event);
  await new Promise<void>((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: c.port, path: '/events', method: 'POST', headers: {'Content-Type':'application/json', Authorization: `Bearer ${c.token}`, 'Content-Length':Buffer.byteLength(body)} }, response => { response.resume(); if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) resolve(); else reject(new Error('Rejected')); });
    const timer = setTimeout(() => request.destroy(new Error('Timeout')), timeoutMs);
    request.on('close', () => clearTimeout(timer)); request.on('error', reject); request.end(body);
  });
}
// A directory lock serializes eviction and publish across independent hook processes.
// Busy writers fail open instead of waiting on an agent-critical path.
export async function spoolEvent(event: AquariumEventV1, dataDir = aquariumDataDir()): Promise<boolean> {
  const dir = path.join(dataDir, 'spool'), lock = path.join(dir, '.writer-lock');
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  try { await fs.mkdir(lock, {mode:0o700}); } catch { try { const stat = await fs.stat(lock); if (Date.now() - stat.mtimeMs > 5000) await fs.rmdir(lock); } catch {} return false; }
  let tmp: string | undefined;
  try {
    const entries: {file:string;size:number;important:boolean}[] = [];
    for (const file of await fs.readdir(dir)) if (/^\d+-[0-9a-f-]+\.json$/.test(file)) {
      try { const raw = await boundedRead(path.join(dir,file), MAX_EVENT_BYTES); const parsed = aquariumEventSchema.safeParse(JSON.parse(raw)); entries.push({file,size:Buffer.byteLength(raw),important:parsed.success && priority.has(parsed.data.kind)}); } catch { await fs.unlink(path.join(dir,file)).catch(() => {}); }
    }
    entries.sort((a,b) => Number(a.important)-Number(b.important) || a.file.localeCompare(b.file));
    const body = JSON.stringify(event); let bytes = entries.reduce((n,e)=>n+e.size,0), count = entries.length;
    while (count >= MAX_EVENTS || bytes + Buffer.byteLength(body) > MAX_BYTES) { const old=entries.shift(); if(!old) break; if(old.important && !priority.has(event.kind)) return false; await fs.unlink(path.join(dir,old.file)).catch(()=>{}); bytes-=old.size; count--; }
    const file = path.join(dir, `${Date.now()}-${randomUUID()}.json`); tmp = `${file}.tmp`;
    await fs.writeFile(tmp, body, {mode:0o600,flag:'wx'}); await fs.rename(tmp,file); return true;
  } finally { if(tmp) await fs.unlink(tmp).catch(()=>{}); await fs.rmdir(lock).catch(()=>{}); }
}
export async function forwardEvent(input: unknown, options: {dataDir?:string;timeoutMs?:number} = {}): Promise<'delivered'|'queued'|'dropped'> {
  const parsed = aquariumEventSchema.safeParse(input); if(!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data)) > MAX_EVENT_BYTES) return 'dropped';
  const dir = options.dataDir ?? aquariumDataDir();
  try { await deliver(parsed.data,dir,options.timeoutMs ?? 150); return 'delivered'; } catch { try { return await spoolEvent(parsed.data,dir) ? 'queued' : 'dropped'; } catch { return 'dropped'; } }
}
export async function drainSpool(dataDir: string, consume: (event:AquariumEventV1)=>Promise<void>|void): Promise<number> {
  const dir=path.join(dataDir,'spool'); let count=0, files:string[]; try { files=await fs.readdir(dir); } catch {return 0;}
  for(const file of files.sort()) if(/^\d+-[0-9a-f-]+\.json$/.test(file)) {
    const full=path.join(dir,file); let event:AquariumEventV1;
    try { event=aquariumEventSchema.parse(JSON.parse(await boundedRead(full,MAX_EVENT_BYTES))); } catch { await fs.unlink(full).catch(()=>{}); continue; }
    try { await consume(event); await fs.unlink(full).catch(()=>{}); count++; } catch { break; }
  }
  return count;
}
