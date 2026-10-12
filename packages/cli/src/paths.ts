import os from 'node:os';
import path from 'node:path';
export function aquariumDataDir(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  return env.AGENT_AQUARIUM_DATA_DIR || (platform === 'win32' ? path.join(env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Agent Aquarium') : platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support', 'Agent Aquarium') : path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Agent Aquarium'));
}
export function claudeSettingsPath(): string { return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'settings.json'); }
