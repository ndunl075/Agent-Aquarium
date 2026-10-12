import { randomUUID, createHash } from 'node:crypto';
import { aquariumEventSchema, type AquariumEventV1, type ProviderCapabilities } from '@aquarium/protocol';

export const claudeCapabilities = { sessions: true, toolLifecycle: true, attention: true, subagents: true, contextPercentage: 'optional', guaranteedSessionEnd: false } as const;
export interface ProviderAdapter<T = unknown> { readonly id: AquariumEventV1['provider']; readonly capabilities: ProviderCapabilities; normalize(payload: T): AquariumEventV1 | null }
const kinds: Record<string, AquariumEventV1['kind']> = {
  SessionStart: 'session_started', UserPromptSubmit: 'turn_started', PreToolUse: 'tool_started', PostToolUse: 'tool_succeeded', PostToolUseFailure: 'tool_failed', PermissionRequest: 'attention_required', Notification: 'attention_required', SubagentStart: 'subagent_started', SubagentStop: 'subagent_stopped', Stop: 'turn_completed', StopFailure: 'turn_failed', SessionEnd: 'session_ended',
};
const tools: Record<string, NonNullable<AquariumEventV1['toolCategory']>> = { Read: 'read', Write: 'write', Edit: 'write', MultiEdit: 'write', NotebookEdit: 'write', Bash: 'shell', PowerShell: 'shell', Grep: 'search', Glob: 'search', WebSearch: 'search', WebFetch: 'read', Agent: 'delegate', Task: 'delegate', AskUserQuestion: 'other' };
function object(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function id(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 && value.length <= 256 && /^[a-zA-Z0-9_.:@+-]+$/.test(value) ? value : undefined; }
export function safeProjectLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const name = value.replace(/[\\/]+$/, '').split(/[\\/]/).pop()?.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 64).trim();
  return name || undefined;
}
export function normalizeClaudeEvent(payload: unknown): AquariumEventV1 | null {
  const p = object(payload); if (!p) return null;
  const sessionId = id(p.session_id); const hook = typeof p.hook_event_name === 'string' ? p.hook_event_name : '';
  const kind = kinds[hook]; if (!sessionId || !kind) return null;
  const child = id(p.agent_id);
  if ((hook === 'SubagentStart' || hook === 'SubagentStop') && !child) return null;
  if (hook === 'Notification' && !['permission_prompt', 'idle_prompt', 'elicitation_dialog', 'elicitation_url_dialog', 'agent_needs_input'].includes(String(p.notification_type))) return null;
  const event: AquariumEventV1 = { version: 1, eventId: randomUUID(), provider: 'claude-code', sessionId, actorId: child ?? 'main', kind, occurredAt: Date.now() };
  if (child) event.parentActorId = 'main';
  const project = safeProjectLabel(p.cwd); if (project) event.projectLabel = project;
  const toolUseId = id(p.tool_use_id); if (toolUseId) event.toolUseId = toolUseId;
  if (typeof p.tool_name === 'string' && Object.hasOwn(tools, p.tool_name)) { event.toolName = p.tool_name; event.toolCategory = tools[p.tool_name]; }
  else if (hook.includes('Tool')) event.toolCategory = 'other';
  if (kind === 'attention_required') event.attentionReason = hook === 'PermissionRequest' || p.notification_type === 'permission_prompt' ? 'permission' : 'input';
  const result = aquariumEventSchema.safeParse(event); return result.success ? result.data : null;
}
export function normalizeClaudeStatus(payload: unknown): AquariumEventV1 | null {
  const p = object(payload); if (!p) return null;
  const sessionId = id(p.session_id); if (!sessionId) return null;
  const context = object(p.context_window); const percentage = context?.used_percentage;
  if (percentage !== null && percentage !== undefined && (typeof percentage !== 'number' || !Number.isFinite(percentage) || percentage < 0 || percentage > 100)) return null;
  const result = aquariumEventSchema.safeParse({ version: 1, eventId: randomUUID(), provider: 'claude-code', sessionId, actorId: 'main', kind: 'context_updated', occurredAt: Date.now(), contextUsedPercent: percentage ?? null, contextSource: 'statusline' });
  return result.success ? result.data : null;
}
export const claudeAdapter: ProviderAdapter = { id: 'claude-code', capabilities: claudeCapabilities, normalize: normalizeClaudeEvent };

/** Codex notify exposes turn completion only. Session identity is real; lifecycle is partial. */
export const codexCapabilities: ProviderCapabilities = {sessions:true,toolLifecycle:false,attention:false,subagents:false,contextPercentage:'none',guaranteedSessionEnd:false};
export function normalizeCodexNotification(payload:unknown):AquariumEventV1|null {
  const p=object(payload);if(!p || p.type!=='agent-turn-complete')return null;
  const sessionId=id(p['thread-id']);if(!sessionId)return null;
  const turnId=id(p['turn-id']);
  const event:AquariumEventV1={version:1,eventId:turnId?`codex-${createHash('sha256').update(JSON.stringify([sessionId,turnId])).digest('hex')}`:randomUUID(),provider:'codex',sessionId,actorId:'main',kind:'turn_completed',occurredAt:Date.now()};
  const project=safeProjectLabel(p.cwd);if(project)event.projectLabel=project;
  const result=aquariumEventSchema.safeParse(event);return result.success?result.data:null;
}
export const codexAdapter:ProviderAdapter={id:'codex',capabilities:codexCapabilities,normalize:normalizeCodexNotification};
