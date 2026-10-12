import { defaultPreferences, type AquariumDesktopAPI, type AquariumSnapshot } from '@aquarium/protocol';

export interface DesktopBridge extends AquariumDesktopAPI {
  previewProvider(provider: 'claude-code'): Promise<{ command: string; settingsPath: string; preview: unknown }>;
  clearLocalData(): Promise<void>;
  captureScreenshot(): Promise<{ saved: boolean }>;
}

export const bridge = (window as Window & { aquarium?: DesktopBridge }).aquarium;
export const previewPreferences = defaultPreferences;

/** A browser-only artwork preview, visibly labeled. Desktop demo data is always main-owned. */
export function browserPreview(): AquariumSnapshot {
  const now = Date.now();
  const roles = ['read', 'write', 'test', 'search', 'delegate'] as const;
  return {
    version: 1, sequence: 0, generatedAt: now, preferences: previewPreferences, demoMode: true,
    agents: roles.map((role, i) => ({
      key: `preview:fish:${i}`, sessionKey: `preview:${i}`, provider: 'custom', sessionId: `preview-${i}`,
      actorId: 'main', projectLabel: ['Drift', 'Pebble', 'Clover', 'Miso', 'Pip'][i],
      status: i === 3 ? 'waiting' : i === 4 ? 'turn_done' : 'using_tool',
      startedAt: now, lastActivityAt: now, statusChangedAt: now - 10000,
      lastToolCategory: role, activeTools: {}, contextUsedPercent: null, contextSource: 'unknown',
      celebrationCount: 0, simulated: true,
    })),
  };
}
