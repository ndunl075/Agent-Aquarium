import { describe, expect, it } from 'vitest';
import type { AgentState } from '@aquarium/protocol';
import { fishName, identity, positionAt } from './model';

const agent: AgentState = {
  key: 'claude-code:session-one:main', sessionKey: 'claude-code:session-one',
  provider: 'claude-code', sessionId: 'session-one', actorId: 'main', projectLabel: 'private-project',
  status: 'working', startedAt: 1000, lastActivityAt: 2000, statusChangedAt: 2000,
  activeTools: {}, contextUsedPercent: null, contextSource: 'unknown', celebrationCount: 0, simulated: false,
};

describe('aquarium presentation invariants', () => {
  it('repeats motion for the same identity and clock, without changing domain state', () => {
    const copy = structuredClone(agent);
    const first = positionAt(agent, 42, 1, 5, false, 44000);
    expect(positionAt(agent, 42, 1, 5, false, 44000)).toEqual(first);
    expect(agent).toEqual(copy);
  });
  it('reduced motion stays still as the animation clock advances', () => {
    expect(positionAt(agent, 0, 1, 5, true, 44000)).toEqual(positionAt(agent, 120, 1, 5, true, 44000));
  });
  it('captures contain identity-derived fish names, never project labels', () => {
    expect(fishName(agent, true)).toBe(`${identity(agent).palette.name} fish`);
    expect(fishName(agent, true)).not.toContain(agent.projectLabel);
  });
  it('keeps thirty active fish inside normalized swimming bounds', () => {
    for (let i = 0; i < 30; i++) for (const seconds of [0, 35, 1000]) {
      const pos = positionAt({ ...agent, key: `actor-${i}` }, seconds, i, 30, false, 44000);
      expect(pos.x).toBeGreaterThan(0.1); expect(pos.x).toBeLessThan(0.95);
      expect(pos.y).toBeGreaterThan(0.15); expect(pos.y).toBeLessThan(0.8);
    }
  });
  it('only ended sessions leave the scene', () => {
    expect(positionAt({ ...agent, status: 'ended', endedAt: 3000 }, 15, 0, 1, false, 20000).x).toBe(1.15);
    expect(positionAt({ ...agent, status: 'turn_done' }, 15, 0, 1, false, 20000).x).toBeLessThan(1);
  });
});
