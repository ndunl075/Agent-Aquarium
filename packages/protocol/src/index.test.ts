import { describe, expect, it } from 'vitest';
import { eventSchema, preferencesSchema, preferencesPatchSchema, defaultPreferences } from './index';
const valid={version:1,eventId:'a',provider:'claude-code',sessionId:'s',actorId:'main',kind:'turn_started',occurredAt:1000};
describe('strict least-data protocol',()=>{
  it('accepts null context and an observed zero separately',()=>{
    expect(eventSchema.parse({...valid,contextUsedPercent:null}).contextUsedPercent).toBeNull();
    expect(eventSchema.parse({...valid,contextUsedPercent:0}).contextUsedPercent).toBe(0);
  });
  it.each([{prompt:'secret'},{tool_input:{}},{command:'echo secret'},{version:2},{sessionId:' '},{actorId:'x'.repeat(257)},{kind:'made_up'},{occurredAt:Infinity},{occurredAt:-1},{contextUsedPercent:101},{toolName:'<script>'},{projectLabel:'C:\\secret\\repo'},{projectLabel:'<img src=x>'}])('rejects invalid or private fields %j',patch=>{
    expect(eventSchema.safeParse({...valid,...patch}).success).toBe(false);
  });
  it('settings patches cannot add arbitrary privileged behavior',()=>{
    expect(preferencesPatchSchema.safeParse({execute:'shell'}).success).toBe(false);
    expect(preferencesPatchSchema.parse({alwaysOnTop:true})).toEqual({alwaysOnTop:true});
    expect(preferencesSchema.parse({})).toEqual(defaultPreferences);
    expect(defaultPreferences.soundEnabled).toBe(false);
  });
});
