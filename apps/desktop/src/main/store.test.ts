import { expect,it } from 'vitest';
import { AquariumStore } from './store';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectSnapshot } from '@aquarium/domain';
it('persists normalized state transactionally, deduplicates and clears data',()=>{
 const store=new AquariumStore(':memory:');const event={version:1 as const,eventId:'one',provider:'custom' as const,sessionId:'s',actorId:'main',kind:'session_started' as const,occurredAt:Date.now()};
 expect(store.accept(event)).toBe(true);expect(store.accept(event)).toBe(false);expect(Object.values(store.state.agents)).toHaveLength(1);
 store.setPreferences({...store.preferences,historyEnabled:false});store.clear();expect(Object.values(store.state.agents)).toHaveLength(0);store.close();
});
it.each(['working','waiting','turn_done'] as const)('restores %s honestly and recovers its meaning after observed heartbeat',(status)=>{
 const directory=mkdtempSync(join(tmpdir(),'aquarium-recovery-'));const file=join(directory,'aquarium.db');
 const now=Date.now();let store=new AquariumStore(file);
 try{
  const kind=status==='working'?'turn_started':status==='waiting'?'attention_required':'turn_completed';
  store.accept({version:1,eventId:'initial',provider:'custom',sessionId:'s',actorId:'main',kind,occurredAt:now});
  store.close();store=new AquariumStore(file);
  expect(Object.values(store.state.agents)[0]?.status).toBe(status);
  expect(projectSnapshot(store.state,now+1).agents[0]?.status).toBe('stale');
  store.accept({version:1,eventId:'fresh',provider:'custom',sessionId:'s',actorId:'main',kind:'heartbeat',occurredAt:now+2});
  expect(projectSnapshot(store.state,now+3).agents[0]?.status).toBe(status);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
