import type { AgentState } from '@aquarium/protocol';

export const palettes = [
  { body: 0xf4b275, light: 0xffe0ae, dark: 0xbc674b, css: '#f4b275', name: 'Apricot' },
  { body: 0x73cfc4, light: 0xc7f0da, dark: 0x298f98, css: '#73cfc4', name: 'Jade' },
  { body: 0xbba4ed, light: 0xe3d5ff, dark: 0x786ca8, css: '#bba4ed', name: 'Iris' },
  { body: 0xf19fa6, light: 0xffd6c7, dark: 0xbb617d, css: '#f19fa6', name: 'Coral' },
  { body: 0xd8d687, light: 0xfaf0bc, dark: 0x8d9e64, css: '#d8d687', name: 'Moss' },
];

export function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function identity(agent: Pick<AgentState, 'key'>) {
  const seed = hash(agent.key);
  return { seed, palette: palettes[seed % palettes.length]!, species: (seed >>> 3) % 3 };
}

export const statusNames: Record<AgentState['status'], string> = {
  starting: 'Arriving', working: 'Working', using_tool: 'Using a tool', waiting: 'Needs attention',
  turn_done: 'Turn complete', error: 'Needs a look', stale: 'Activity unknown', ended: 'Session ended',
};

export const toolNames: Record<string, string> = {
  read: 'Reading', write: 'Writing', shell: 'Running a command', test: 'Running tests',
  search: 'Searching', delegate: 'Delegating', other: 'Using a tool',
};

export function activity(agent: AgentState): string {
  if (agent.status === 'using_tool') return toolNames[agent.lastToolCategory ?? 'other'] ?? 'Using a tool';
  return statusNames[agent.status];
}

export function fishName(agent: AgentState, masked = false): string {
  if (masked) return `${identity(agent).palette.name} fish`;
  return agent.projectLabel || `${identity(agent).palette.name} fish`;
}

/** A transient presentation of an observed failed tool; never a failed turn. */
export function toolFailureIntensity(agent: AgentState, now = Date.now()): number {
  if (agent.lastToolFailedAt == null || (agent.status !== 'working' && agent.status !== 'using_tool')) return 0;
  const age = now - agent.lastToolFailedAt;
  return age >= 0 && age < 3000 ? 1 - age / 3000 : 0;
}

/** Presentation only: status is supplied by the domain; movement never invents state. */
export function positionAt(agent: AgentState, seconds: number, slot: number, count: number, reduced: boolean, now = Date.now()) {
  const { seed } = identity(agent);
  const phase = (seed % 628) / 100;
  const t = reduced ? 0 : seconds;
  // Every actor owns a cell. Tool/attention motion stays within that cell, so
  // simultaneous writers or waiters cannot collapse into one location.
  const smallTank = [[0.25, 0.26], [0.51, 0.47], [0.78, 0.26], [0.26, 0.69], [0.77, 0.69]];
  const columns = count <= 12 ? 4 : 6;
  const rows = Math.ceil(count / columns);
  const cell = count <= 5 ? smallTank[slot % 5]!
    : [0.13 + (slot % columns) * (0.74 / (columns - 1)), 0.24 + Math.floor(slot / columns) * (0.49 / Math.max(rows - 1, 1))];
  let x = cell[0]!;
  let y = cell[1]!;
  const motionScale = count > 12 ? 0.3 : count > 5 ? 0.55 : 1;
  let angle = 0;
  let direction = Math.cos(t * 0.17 + phase) >= 0 ? 1 : -1;
  const wave = Math.sin(t * 0.4 + phase);
  if (agent.status === 'waiting') {
    x += 0.012 * motionScale;
    y += wave * 0.005 * motionScale;
    direction = 1;
  } else if (agent.status === 'ended') {
    x = Math.min(1.15, x + Math.max(0, now - (agent.endedAt ?? agent.statusChangedAt)) / 9000);
  } else {
    const speed = agent.lastToolCategory === 'shell' && agent.status === 'using_tool' ? 1.8 : 1;
    x += Math.sin(t * 0.17 * speed + phase) * 0.038 * motionScale;
    y += wave * (agent.status === 'stale' ? 0.003 : 0.012) * motionScale;
    angle = Math.cos(t * 0.4 + phase) * 0.04;
    if (agent.status === 'using_tool') {
      if (agent.lastToolCategory === 'read' || agent.lastToolCategory === 'search') angle += 0.12 * Math.sin(t + phase);
      if (agent.lastToolCategory === 'write') { y += 0.025 * motionScale; x += Math.sin(t * 1.8) * 0.006 * motionScale; }
      if (agent.lastToolCategory === 'test') y += Math.sin(t * 1.3 + phase) * 0.018 * motionScale;
      if (agent.lastToolCategory === 'delegate') x += Math.sin(t * 0.8 + phase) * 0.015 * motionScale;
    }
    if (agent.status === 'error') angle += Math.sin(t * 2.2) * 0.07;
    const failureIntensity = toolFailureIntensity(agent, now);
    if (!reduced && failureIntensity > 0) {
      angle += Math.sin((now - agent.lastToolFailedAt!) / 1000 * 9) * 0.1 * failureIntensity;
    }
    if (agent.status === 'turn_done') {
      const age = (now - agent.statusChangedAt) / 1000;
      if (age < 3 && age >= 0 && !reduced) { y += Math.sin(age * Math.PI * 2 / 3) * 0.025 * motionScale; angle += Math.sin(age * Math.PI * 2 / 3) * 0.23; }
    }
  }
  return { x, y, angle, direction, phase };
}
