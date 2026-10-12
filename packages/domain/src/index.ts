import { defaultPreferences, eventSchema, type AgentState, type AquariumEventV1, type AquariumSnapshot, type Preferences, type Provider } from '@aquarium/protocol';
export type { AgentState, AquariumSnapshot } from '@aquarium/protocol';

export interface DomainState { agents: Record<string, AgentState>; seenEventIds: string[]; sequence: number }
// Durable event-id deduplication remains the receiver/database's responsibility.
export const MAX_RECENT_EVENT_IDS = 10_000;
export const MAX_ACTIVE_TOOLS = 256;
export const createInitialState = (): DomainState => ({ agents: {}, seenEventIds: [], sequence: 0 });
/** JSON tuples prevent delimiter collisions in opaque provider identifiers. */
export const sessionKey = (provider: Provider, sessionId: string): string => JSON.stringify([provider, sessionId]);
export const actorKey = (provider: Provider, sessionId: string, actorId = 'main'): string => JSON.stringify([provider, sessionId, actorId]);
export const agentKey = actorKey;
export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function createAgent(event: AquariumEventV1): AgentState {
  return {
    key: actorKey(event.provider,event.sessionId,event.actorId), sessionKey: sessionKey(event.provider,event.sessionId),
    provider:event.provider,sessionId:event.sessionId,actorId:event.actorId,
    ...(event.actorId !== 'main' ? {parentKey:actorKey(event.provider,event.sessionId,event.parentActorId ?? 'main')} : {}),
    ...(event.projectLabel ? {projectLabel:event.projectLabel}:{}),
    status:'starting',startedAt:event.occurredAt,lastActivityAt:event.occurredAt,statusChangedAt:event.occurredAt,
    activeTools:{},contextUsedPercent:null,contextSource:'unknown',celebrationCount:0,simulated:false,
  };
}
/** Pure event reducer. Time-based visibility belongs exclusively to projectSnapshot. */
export function reduceEvent(state: DomainState, input: AquariumEventV1): DomainState {
  const event = eventSchema.parse(input);
  if (state.seenEventIds.includes(event.eventId)) return state;
  const key = actorKey(event.provider,event.sessionId,event.actorId);
  const previous = state.agents[key];
  const agent: AgentState = previous ? {...previous,activeTools:{...previous.activeTools}} : createAgent(event);
  const next: DomainState = {agents:{...state.agents},seenEventIds:[...state.seenEventIds.slice(-(MAX_RECENT_EVENT_IDS-1)),event.eventId],sequence:state.sequence+1};
  // Even ignored late deliveries receive a sequence, so replay and persistence agree.
  next.agents[key] = agent;
  const parent = next.agents[actorKey(event.provider,event.sessionId)];
  // A delivery for a child cannot resurrect a session after its parent ended.
  if (event.actorId !== 'main' && parent?.status === 'ended') {
    next.agents[key] = {...agent,status:'ended',endedAt:parent.endedAt ?? parent.statusChangedAt,activeTools:{}};
    return next;
  }
  if (event.occurredAt < agent.startedAt) agent.startedAt = event.occurredAt;
  const newer = event.occurredAt >= agent.statusChangedAt;
  const explicitResume = event.kind === 'session_started' && event.occurredAt > agent.statusChangedAt;
  if (agent.status === 'ended' && !explicitResume) return next;
  agent.lastActivityAt = Math.max(agent.lastActivityAt,event.occurredAt);
  if (event.projectLabel && newer) agent.projectLabel = event.projectLabel;
  if (event.kind === 'context_updated') {
    if (event.occurredAt >= (agent.contextObservedAt ?? 0)) {
      agent.contextUsedPercent = event.contextUsedPercent ?? null;
      agent.contextSource = agent.contextUsedPercent === null ? 'unknown' : event.contextSource ?? 'provider';
      agent.contextObservedAt = event.occurredAt;
    }
    return next;
  }
  if (event.kind === 'heartbeat' || !newer) return next;
  if (previous && event.occurredAt === agent.statusChangedAt && ['turn_done','error'].includes(agent.status) && !['turn_completed','turn_failed','session_ended','subagent_stopped'].includes(event.kind)) return next;
  const setStatus = (status: AgentState['status']) => {agent.status=status;agent.statusChangedAt=event.occurredAt;delete agent.attentionReason;};
  const endedTurn = agent.status === 'turn_done' || agent.status === 'error';
  switch (event.kind) {
    case 'session_started':
    case 'subagent_started':
      setStatus('starting');agent.activeTools={};delete agent.endedAt;break;
    case 'turn_started':
      setStatus('working');agent.activeTools={};break;
    case 'tool_started': {
      if (endedTurn) break;
      const toolId=event.toolUseId ?? `unpaired:${event.eventId}`;
      agent.activeTools={...agent.activeTools,[toolId]:{id:toolId,category:event.toolCategory ?? 'other',...(event.toolName ? {name:event.toolName}:{}),startedAt:event.occurredAt}};
      // Pathological never-finishing producers cannot grow the actor indefinitely.
      // Retain the most recent observed starts; a discarded ID cannot close another tool.
      const toolIds=Object.keys(agent.activeTools).sort((a,b)=>agent.activeTools[a]!.startedAt-agent.activeTools[b]!.startedAt || a.localeCompare(b));
      for (const oldId of toolIds.slice(0,Math.max(0,toolIds.length-MAX_ACTIVE_TOOLS))) delete agent.activeTools[oldId];
      agent.lastToolCategory=event.toolCategory ?? 'other';
      if (event.toolName) agent.lastToolName=event.toolName;
      setStatus('using_tool');break;
    }
    case 'tool_succeeded':
    case 'tool_failed': {
      if (endedTurn) break;
      const ids=Object.keys(agent.activeTools);
      const toolId=event.toolUseId ?? (ids.length === 1 && ids[0]?.startsWith('unpaired:') ? ids[0]:undefined);
      if (toolId && !Object.hasOwn(agent.activeTools,toolId)) break;
      if (!toolId && ids.length > 0) break;
      if (toolId) delete agent.activeTools[toolId];
      if (event.kind === 'tool_failed') agent.lastToolFailedAt=event.occurredAt;
      setStatus(Object.keys(agent.activeTools).length ? 'using_tool':'working');break;
    }
    case 'attention_required':
      if (endedTurn) break;
      setStatus('waiting');agent.attentionReason=event.attentionReason ?? 'other';break;
    case 'turn_completed':
      if (agent.status !== 'turn_done') agent.celebrationCount++;
      setStatus('turn_done');agent.activeTools={};break;
    case 'turn_failed':setStatus('error');agent.activeTools={};break;
    case 'session_ended':
    case 'subagent_stopped':
      setStatus('ended');agent.endedAt=event.occurredAt;agent.activeTools={};
      if (event.kind === 'session_ended' && event.actorId === 'main') {
        for (const child of Object.values(next.agents)) {
          if (child.key !== key && child.sessionKey === agent.sessionKey && child.statusChangedAt <= event.occurredAt) {
            next.agents[child.key]={...child,status:'ended',endedAt:event.occurredAt,statusChangedAt:event.occurredAt,activeTools:{}};
          }
        }
      }
      break;
  }
  return next;
}
export function projectSnapshot(state: DomainState, now: number, preferences: Preferences = defaultPreferences, demoMode = false): AquariumSnapshot {
  const agents = Object.values(state.agents)
    .filter(agent => agent.status !== 'ended' || now - (agent.endedAt ?? agent.lastActivityAt) < preferences.lingerMs)
    .map(agent => ({...agent,activeTools:{...agent.activeTools},status:agent.status !== 'ended' && now-agent.lastActivityAt >= preferences.staleAfterMs ? 'stale' as const:agent.status}))
    .sort((a,b)=>a.startedAt-b.startedAt || a.key.localeCompare(b.key));
  return {version:1,sequence:state.sequence,generatedAt:now,agents,preferences:{...preferences},demoMode};
}
