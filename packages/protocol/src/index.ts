import { z } from 'zod';

const id = z.string().trim().min(1).max(256).refine(v => !/[\u0000-\u001f\u007f]/u.test(v), 'Control characters are forbidden');
const timestamp = z.number().int().nonnegative().max(8_640_000_000_000_000);
const label = z.string().trim().min(1).max(80).refine(v => !/[\\/<>\u0000-\u001f\u007f]/u.test(v), 'Only a safe display label is allowed');
export const providerSchema = z.enum(['claude-code', 'codex', 'custom']);
export const toolCategorySchema = z.enum(['read', 'write', 'shell', 'test', 'search', 'delegate', 'other']);
export const agentStatusSchema = z.enum(['starting', 'working', 'using_tool', 'waiting', 'turn_done', 'error', 'stale', 'ended']);
export const eventKindSchema = z.enum(['session_started', 'turn_started', 'tool_started', 'tool_succeeded', 'tool_failed', 'attention_required', 'turn_completed', 'turn_failed', 'subagent_started', 'subagent_stopped', 'session_ended', 'context_updated', 'heartbeat']);
export const contextSourceSchema = z.enum(['statusline', 'provider', 'unknown']);
export const attentionReasonSchema = z.enum(['permission', 'input', 'other']);
export const eventSchema = z.object({
  version: z.literal(1), eventId: id, provider: providerSchema, sessionId: id, actorId: id,
  parentActorId: id.optional(), kind: eventKindSchema, occurredAt: timestamp,
  toolUseId: id.optional(), toolCategory: toolCategorySchema.optional(),
  toolName: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_.:-]+$/u).optional(),
  projectLabel: label.optional(), contextUsedPercent: z.number().finite().min(0).max(100).nullable().optional(),
  contextSource: contextSourceSchema.optional(), attentionReason: attentionReasonSchema.optional(),
}).strict();
export type AquariumEventV1 = z.infer<typeof eventSchema>;
export const aquariumEventSchema = eventSchema;
export type Provider = z.infer<typeof providerSchema>;
export type AgentEventKind = z.infer<typeof eventKindSchema>;
export type ToolCategory = z.infer<typeof toolCategorySchema>;
export type AgentStatus = z.infer<typeof agentStatusSchema>;

export const preferencesSchema = z.object({
  soundEnabled: z.boolean().default(false), notificationsEnabled: z.boolean().default(false),
  reducedMotion: z.boolean().default(false), alwaysOnTop: z.boolean().default(false),
  tankSize: z.enum(['full', 'mini']).default('full'), theme: z.enum(['deep', 'reef', 'midnight']).default('deep'),
  captureMode: z.boolean().default(false), batterySaver: z.boolean().default(false),
  staleAfterMs: z.number().int().min(10_000).max(86_400_000).default(120_000),
  lingerMs: z.number().int().min(0).max(600_000).default(15_000),
  eventRetentionDays: z.number().int().min(0).max(365).default(7),
  sessionRetentionDays: z.number().int().min(0).max(365).default(30), historyEnabled: z.boolean().default(true),
}).strict();
export type Preferences = z.infer<typeof preferencesSchema>;
// Strip field defaults before partializing: omitted patch keys must stay omitted.
export const preferencesPatchSchema = z.object({
  soundEnabled:preferencesSchema.shape.soundEnabled.removeDefault().optional(),
  notificationsEnabled:preferencesSchema.shape.notificationsEnabled.removeDefault().optional(),
  reducedMotion:preferencesSchema.shape.reducedMotion.removeDefault().optional(),
  alwaysOnTop:preferencesSchema.shape.alwaysOnTop.removeDefault().optional(),
  tankSize:preferencesSchema.shape.tankSize.removeDefault().optional(),
  theme:preferencesSchema.shape.theme.removeDefault().optional(),
  captureMode:preferencesSchema.shape.captureMode.removeDefault().optional(),
  batterySaver:preferencesSchema.shape.batterySaver.removeDefault().optional(),
  staleAfterMs:preferencesSchema.shape.staleAfterMs.removeDefault().optional(),
  lingerMs:preferencesSchema.shape.lingerMs.removeDefault().optional(),
  eventRetentionDays:preferencesSchema.shape.eventRetentionDays.removeDefault().optional(),
  sessionRetentionDays:preferencesSchema.shape.sessionRetentionDays.removeDefault().optional(),
  historyEnabled:preferencesSchema.shape.historyEnabled.removeDefault().optional(),
}).strict();
export type PreferencesPatch = z.infer<typeof preferencesPatchSchema>;
export const defaultPreferences: Preferences = Object.freeze(preferencesSchema.parse({}));

export const activeToolSchema = z.object({ id, category: toolCategorySchema, name: z.string().max(64).optional(), startedAt: timestamp }).strict();
export const agentStateSchema = z.object({
  key: z.string(), sessionKey: z.string(), provider: providerSchema, sessionId: id, actorId: id,
  parentKey: z.string().optional(), projectLabel: label.optional(), status: agentStatusSchema,
  startedAt: timestamp, lastActivityAt: timestamp, statusChangedAt: timestamp, endedAt: timestamp.optional(),
  lastToolCategory: toolCategorySchema.optional(), lastToolName: z.string().max(64).optional(),
  activeTools: z.record(z.string(), activeToolSchema), contextUsedPercent: z.number().min(0).max(100).nullable(),
  contextSource: contextSourceSchema, contextObservedAt: timestamp.optional(),
  attentionReason: attentionReasonSchema.optional(), lastToolFailedAt: timestamp.optional(),
  celebrationCount: z.number().int().nonnegative(), simulated: z.boolean(),
}).strict();
export type AgentState = z.infer<typeof agentStateSchema>;
export const snapshotSchema = z.object({version: z.literal(1),sequence: z.number().int().nonnegative(), generatedAt: timestamp, agents: z.array(agentStateSchema), preferences: preferencesSchema, demoMode: z.boolean()}).strict();
export type AquariumSnapshot = z.infer<typeof snapshotSchema>;
export const deltaSchema = z.object({version: z.literal(1), sequence: z.number().int().nonnegative(), snapshot: snapshotSchema}).strict();
export type AquariumDelta = z.infer<typeof deltaSchema>;
export const installResultSchema = z.object({ok:z.boolean(),changed:z.boolean(),message:z.string().max(500),restartRequired:z.boolean().optional(),preview:z.string().max(16_384).optional()}).strict();
export type InstallResult = z.infer<typeof installResultSchema>;
export const safeDiagnosticsSchema = z.object({version:z.literal(1),listenerRunning:z.boolean(),providerInstalled:z.boolean(),queuedEvents:z.number().int().nonnegative(),issues:z.array(z.string().max(500)),appVersion:z.string().max(64)}).strict();
export type SafeDiagnostics = z.infer<typeof safeDiagnosticsSchema>;
export interface AquariumDesktopAPI {
  getSnapshot(): Promise<AquariumSnapshot>;
  onDelta(callback:(delta:AquariumDelta)=>void):()=>void;
  updatePreferences(patch:PreferencesPatch):Promise<void>;
  installProvider(provider:'claude-code'):Promise<InstallResult>;
  previewProvider(provider:'claude-code'):Promise<{command:string;settingsPath:string;preview:unknown}>;
  uninstallProvider(provider:'claude-code'):Promise<InstallResult>;
  getDiagnostics():Promise<SafeDiagnostics>;
  activateDemoMode(enabled:boolean):Promise<void>;
  setWindowMode(mode:'full'|'mini'):Promise<void>;
  clearLocalData():Promise<void>;
  captureScreenshot():Promise<{saved:boolean}>;
  checkForUpdates():Promise<void>;
}
export interface ProviderCapabilities { sessions:boolean; toolLifecycle:boolean; attention:boolean; subagents:boolean; contextPercentage:'none'|'optional'|'reliable'; guaranteedSessionEnd:boolean }
export interface ProviderAdapter<RawEvent> {readonly id:Provider; readonly capabilities:ProviderCapabilities; normalize(raw:RawEvent):AquariumEventV1|null;install?():Promise<InstallResult>;uninstall?():Promise<InstallResult>;doctor?():Promise<SafeDiagnostics>}
export const IPC_CHANNELS = Object.freeze({snapshot:'aquarium:snapshot',delta:'aquarium:delta',preferences:'aquarium:preferences',install:'aquarium:install',preview:'aquarium:preview',uninstall:'aquarium:uninstall',diagnostics:'aquarium:diagnostics',demo:'aquarium:demo',window:'aquarium:window',clear:'aquarium:clear',capture:'aquarium:capture',updates:'aquarium:updates'});
