import { useEffect, useRef } from 'react';
import type { AquariumSnapshot } from '@aquarium/protocol';

/** Local synthesized cues only. No audio files, remote requests, or startup replay. */
export function useAquariumSound(snapshot: AquariumSnapshot | null) {
  const context = useRef<AudioContext | null>(null);
  const previous = useRef<AquariumSnapshot | null>(null);
  const lastCue = useRef(0);
  const enable = () => {
    try {
      context.current ??= new AudioContext();
      void context.current.resume().catch(() => undefined);
    } catch { /* Audio is optional; unavailable devices never affect the tank. */ }
  };
  useEffect(() => {
    const old = previous.current;
    previous.current = snapshot;
    if (!snapshot || !old || !snapshot.preferences.soundEnabled || document.hidden || snapshot.demoMode !== old.demoMode) return;
    const changed = snapshot.agents.find(agent => {
      const before = old.agents.find(a => a.key === agent.key);
      return before && ((agent.status === 'waiting' && before.status !== 'waiting') || agent.celebrationCount > before.celebrationCount);
    });
    const audio = context.current;
    if (!changed || !audio || audio.state !== 'running' || Date.now() - lastCue.current < 1200) return;
    lastCue.current = Date.now();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(changed.status === 'waiting' ? 520 : 660, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(changed.status === 'waiting' ? 460 : 880, audio.currentTime + 0.16);
    gain.gain.setValueAtTime(0, audio.currentTime);
    gain.gain.linearRampToValueAtTime(0.035, audio.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.28);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + 0.3);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }, [snapshot]);
  useEffect(() => () => { void context.current?.close().catch(() => undefined); context.current = null; }, []);
  return enable;
}
