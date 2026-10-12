import type { AquariumEventV1, AgentEventKind, ToolCategory } from '@aquarium/protocol';
export function fixtureEvent(overrides: Partial<AquariumEventV1> = {}): AquariumEventV1 {
  return {version:1,eventId:'fixture-start',provider:'claude-code',sessionId:'fixture-session',actorId:'main',kind:'session_started',occurredAt:1_000,projectLabel:'aquarium',...overrides};
}
/** Every synthetic session is explicitly identifiable as demo, including on disk. */
export function demoEvents(now: number, cycle = 0): AquariumEventV1[] {
  const roles: Array<{kind:AgentEventKind;toolCategory?:ToolCategory}> = [
    {kind:'tool_started',toolCategory:'read'}, {kind:'tool_started',toolCategory:'write'},
    {kind:'tool_started',toolCategory:'test'}, {kind:'attention_required'}, {kind:'turn_completed'},
  ];
  return roles.flatMap((role,index) => {
    const sessionId=`demo:session-${index+1}`;
    const base = {version:1 as const,provider:'custom' as const,sessionId,actorId:'main',projectLabel:'Demo reef'};
    return [
      {...base,eventId:`demo:${cycle}:${index}:start`,kind:'session_started' as const,occurredAt:now},
      {...base,eventId:`demo:${cycle}:${index}:turn`,kind:'turn_started' as const,occurredAt:now+1},
      {...base,eventId:`demo:${cycle}:${index}:role`,...role,occurredAt:now+2,...(role.toolCategory ? {toolUseId:`demo-tool-${index}`} : {}),...(role.kind === 'attention_required' ? {attentionReason:'permission' as const}: {})},
    ];
  });
}
export const createDemoEvents = demoEvents;
