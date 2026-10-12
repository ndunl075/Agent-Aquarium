import { expect,it } from 'vitest';
import { AquariumStore } from './store';
it('persists normalized state transactionally, deduplicates and clears data',()=>{
 const store=new AquariumStore(':memory:');const event={version:1 as const,eventId:'one',provider:'custom' as const,sessionId:'s',actorId:'main',kind:'session_started' as const,occurredAt:Date.now()};
 expect(store.accept(event)).toBe(true);expect(store.accept(event)).toBe(false);expect(Object.values(store.state.agents)).toHaveLength(1);
 store.setPreferences({...store.preferences,historyEnabled:false});store.clear();expect(Object.values(store.state.agents)).toHaveLength(0);store.close();
});
