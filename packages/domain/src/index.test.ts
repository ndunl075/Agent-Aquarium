import { describe, expect, it } from 'vitest';
import type { AquariumEventV1 } from '@aquarium/protocol';
import { createInitialState, reduceEvent, projectSnapshot, actorKey, stableHash } from './index';
const event=(kind:AquariumEventV1['kind'],time=1000,extra:Partial<AquariumEventV1>={}):AquariumEventV1=>({version:1,eventId:`${kind}:${time}`,provider:'claude-code',sessionId:'s',actorId:'main',kind,occurredAt:time,...extra});
const run=(...events:AquariumEventV1[])=>events.reduce(reduceEvent,createInitialState());
const first=(state:ReturnType<typeof createInitialState>)=>Object.values(state.agents)[0]!;
describe('deterministic truthful lifecycle',()=>{
  it('creates five independent fish in the same project',()=>{
    const state=run(...Array.from({length:5},(_,i)=>event('session_started',1000,{eventId:`session${i}`,sessionId:`session${i}`,projectLabel:'same-repo'})));
    expect(projectSnapshot(state,1100).agents).toHaveLength(5);
    expect(new Set(Object.keys(state.agents)).size).toBe(5);
  });
  it('uses collision-proof opaque identity tuples',()=>{
    expect(actorKey('custom','a:b','c')).not.toBe(actorKey('custom','a','b:c'));
    expect(stableHash('fish')).toBe(stableHash('fish'));
  });
  it('deduplicates without changing sequence or celebration',()=>{
    const done=event('turn_completed'); const state=run(done);
    expect(reduceEvent(state,done)).toBe(state);expect(first(state).celebrationCount).toBe(1);
  });
  it('Stop completes a turn but keeps its fish, and new turn resumes',()=>{
    const state=run(event('turn_completed'));
    expect(first(state).status).toBe('turn_done');expect(projectSnapshot(state,1100).agents).toHaveLength(1);
    expect(first(reduceEvent(state,event('turn_started',1100))).status).toBe('working');
  });
  it('late and even later tool deliveries cannot undo completion',()=>{
    const state=run(event('tool_started',1000,{toolUseId:'a'}),event('turn_completed',2000),event('tool_succeeded',1500,{toolUseId:'a'}),event('tool_started',3000,{toolUseId:'b'}));
    expect(first(state).status).toBe('turn_done');expect(first(state).activeTools).toEqual({});
  });
  it('pairs concurrent tools and ignores wrong tool completions',()=>{
    let state=run(event('tool_started',1000,{toolUseId:'a'}),event('tool_started',1100,{toolUseId:'b'}),event('tool_succeeded',1200,{toolUseId:'wrong'}));
    expect(Object.keys(first(state).activeTools)).toEqual(['a','b']);
    state=reduceEvent(state,event('tool_succeeded',1300,{toolUseId:'a'}));expect(first(state).status).toBe('using_tool');
    state=reduceEvent(state,event('tool_failed',1400,{toolUseId:'b'}));expect(first(state).status).toBe('working');expect(first(state).lastToolFailedAt).toBe(1400);
  });
  it('context is unknown until observed; null never invents zero',()=>{
    let state=run(event('session_started'));expect(first(state).contextUsedPercent).toBeNull();
    state=reduceEvent(state,event('context_updated',1100,{contextUsedPercent:0,contextSource:'statusline'}));expect(first(state).contextUsedPercent).toBe(0);
    state=reduceEvent(state,event('context_updated',1200,{contextUsedPercent:null}));expect(first(state).contextUsedPercent).toBeNull();
    state=reduceEvent(state,event('context_updated',1150,{contextUsedPercent:90}));expect(first(state).contextUsedPercent).toBeNull();
  });
  it('telemetry order cannot suppress a genuine lifecycle fact',()=>{
    const state=run(event('turn_started',1000),event('context_updated',2000,{contextUsedPercent:30}),event('turn_completed',1500));
    expect(first(state).status).toBe('turn_done');expect(first(state).lastActivityAt).toBe(2000);
  });
  it('projects stale without mutating state, and heartbeat restores prior meaning',()=>{
    let state=run(event('turn_started'));expect(projectSnapshot(state,121000).agents[0]?.status).toBe('stale');expect(first(state).status).toBe('working');
    state=reduceEvent(state,event('heartbeat',122000));expect(projectSnapshot(state,122001).agents[0]?.status).toBe('working');
  });
  it('end is terminal except explicit later session resume; linger removes only projection',()=>{
    let state=run(event('session_ended',2000),event('turn_started',3000));expect(first(state).status).toBe('ended');
    expect(projectSnapshot(state,17000).agents).toHaveLength(0);expect(Object.values(state.agents)).toHaveLength(1);
    state=reduceEvent(state,event('session_started',4000));expect(first(state).status).toBe('starting');expect(first(state).endedAt).toBeUndefined();
  });
  it('links and retires exact subagents independently, then cascades parent end',()=>{
    let state=run(event('session_started'),event('subagent_started',1100,{actorId:'child-a',parentActorId:'main'}),event('subagent_started',1200,{actorId:'child-b'}),event('subagent_stopped',1300,{actorId:'child-a'}));
    expect(state.agents[actorKey('claude-code','s','child-a')]?.parentKey).toBe(actorKey('claude-code','s'));
    expect(state.agents[actorKey('claude-code','s','child-b')]?.status).toBe('starting');
    state=reduceEvent(state,event('session_ended',2000));expect(Object.values(state.agents).every(a=>a.status==='ended')).toBe(true);
  });
  it('does not mutate input state or active tool objects',()=>{
    const state=run(event('tool_started',1000,{toolUseId:'a'}));const saved=JSON.stringify(state);
    reduceEvent(state,event('tool_succeeded',1100,{toolUseId:'a'}));expect(JSON.stringify(state)).toBe(saved);
  });
  it('does not resurrect parent or children through delayed spawn facts',()=>{
    const state=run(event('session_ended',2000),event('subagent_started',1500,{actorId:'late-child'}));
    expect(Object.values(state.agents).every(a=>a.status==='ended')).toBe(true);
  });
  it('completion wins timestamp ties over a delayed turn start',()=>{
    const state=run(event('turn_completed'),event('turn_started'));
    expect(first(state).status).toBe('turn_done');
  });
});
