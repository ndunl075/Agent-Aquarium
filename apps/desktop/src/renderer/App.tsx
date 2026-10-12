import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AgentState, AquariumSnapshot, Preferences } from '@aquarium/protocol';
import { AquariumScene } from './aquarium/Scene';
import { activity, fishName, identity, statusNames } from './aquarium/model';
import { bridge, browserPreview, previewPreferences } from './bridge';
import { Icon } from './components/Icon';
import { useAquariumSound } from './aquarium/sound';

type Panel = 'settings' | 'connect' | 'diagnostics' | null;
type Preview = Awaited<ReturnType<NonNullable<typeof bridge>['previewProvider']>>;

function Toggle({ label, detail, checked, onChange, disabled = false }: {
  label: string; detail?: string; checked: boolean; onChange(value: boolean): void; disabled?: boolean;
}) {
  return <label className={`toggle-row${disabled ? ' disabled' : ''}`}><span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /><i aria-hidden="true" />
  </label>;
}

function Sheet({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose(): void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = panel.current!;
    element.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'));
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [onClose]);
  return <div className="sheet-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="sheet" ref={panel} role="dialog" aria-modal="true" aria-label={title}>
      <header className="sheet-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="icon-button" aria-label="Close panel" onClick={onClose}><Icon name="close" /></button></header>
      <div className="sheet-body">{children}</div>
    </section>
  </div>;
}

function Inspector({ agent, masked }: { agent: AgentState; masked: boolean }) {
  const { palette } = identity(agent);
  return <>
    <div className="inspector-specimen" style={{ '--fish-color': palette.css } as React.CSSProperties}>
      <div className="specimen-fish"><i /><b /><span /></div><span>{agent.simulated ? 'SIMULATED AGENT' : 'OBSERVED SESSION'}</span>
    </div>
    <div className={`activity-card state-${agent.status}`}><span className="status-glyph">{agent.status === 'waiting' ? '!' : agent.status === 'turn_done' ? '✓' : agent.status === 'error' ? '×' : '≈'}</span><div><strong>{activity(agent)}</strong><small>{agent.status === 'stale' ? 'No recent event. The agent may still be working.' : 'Based on the latest observed event'}</small></div></div>
    <dl className="detail-list">
      <div><dt>Provider</dt><dd>{agent.provider === 'claude-code' ? 'Claude Code' : agent.provider === 'codex' ? 'Codex' : 'Custom'}{agent.simulated ? ' · Demo' : ''}</dd></div>
      <div><dt>Project</dt><dd>{masked ? 'Hidden in capture mode' : agent.projectLabel || 'Not supplied'}</dd></div>
      <div><dt>Session</dt><dd>{masked ? 'Hidden in capture mode' : agent.sessionId.slice(0, 22)}</dd></div>
      <div><dt>Actor</dt><dd>{agent.parentKey ? 'Subagent' : 'Parent session'}</dd></div>
      <div><dt>Last activity</dt><dd>{new Date(agent.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</dd></div>
      <div><dt>Last tool</dt><dd>{agent.lastToolCategory || 'None observed'}</dd></div>
    </dl>
    <div className="context-card"><div><span>Context window</span><strong>{agent.contextUsedPercent == null ? 'Unknown' : `${Math.round(agent.contextUsedPercent)}%`}</strong></div>
      {agent.contextUsedPercent != null && <meter min={0} max={100} value={agent.contextUsedPercent} aria-label="Observed context used" />}
      <p>{agent.contextUsedPercent == null ? 'Lifecycle hooks do not report context usage. We leave it unknown.' : `Reported by ${agent.contextSource}.${agent.contextObservedAt && Date.now() - agent.contextObservedAt > 120000 ? ' This reading may be stale.' : ''}`}</p>
    </div>
    <p className="quiet-note"><Icon name="shield" size={15} /> Prompts, code, and command contents never enter this tank.</p>
  </>;
}

export function App() {
  const [snapshot, setSnapshot] = useState<AquariumSnapshot | null>(() => bridge ? null : browserPreview());
  const enableSound = useAquariumSound(snapshot);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'working' | 'waiting'>('all');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [diagnostics, setDiagnostics] = useState<Awaited<ReturnType<NonNullable<typeof bridge>['getDiagnostics']>> | null>(null);
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [confirmClear, setConfirmClear] = useState(false);
  const [captureActive, setCaptureActive] = useState(false);
  const sequence = useRef(-1);
  const pending = useRef(false);
  const closePanel = useCallback(() => { setPanel(null); setSelected(null); setConfirmClear(false); }, []);
  const preferences = snapshot?.preferences ?? previewPreferences;
  const masked = preferences.captureMode || captureActive;
  const agents = snapshot?.agents ?? [];
  const mini = preferences.tankSize === 'mini';
  const chosen = masked ? undefined : agents.find(agent => agent.key === selected);
  const liveCount = agents.filter(agent => !agent.simulated && agent.status !== 'ended').length;
  const waiting = agents.filter(agent => agent.status === 'waiting').length;
  const working = agents.filter(agent => ['starting', 'working', 'using_tool'].includes(agent.status)).length;
  const visibleAgents = agents.filter(agent => filter === 'all' || (filter === 'waiting' ? agent.status === 'waiting' : ['starting', 'working', 'using_tool'].includes(agent.status)));

  const refresh = useCallback(async () => {
    if (!bridge) return;
    const next = await bridge.getSnapshot();
    if (next.sequence >= sequence.current) { sequence.current = next.sequence; setSnapshot(next); }
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setSystemReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    if (!bridge) return;
    let mounted = true;
    const unsubscribe = bridge.onDelta(delta => {
      if (!mounted || delta.sequence <= sequence.current) return;
      if (sequence.current >= 0 && delta.sequence !== sequence.current + 1) {
        void refresh().catch(() => setError('Connection interrupted. Retry to refresh the tank.'));
        return;
      }
      sequence.current = delta.sequence; setSnapshot(delta.snapshot);
    });
    void refresh().catch(() => setError('The aquarium could not load. Retry the local connection.'));
    return () => { mounted = false; unsubscribe(); };
  }, [refresh]);

  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); await refresh(); }
    catch { setError('That action could not be completed. Open diagnostics or try again.'); }
    finally { pending.current = false; setBusy(false); }
  };

  const update = (patch: Partial<Preferences>) => {
    if (patch.soundEnabled) enableSound();
    if (!bridge) { setSnapshot(previous => previous ? { ...previous, preferences: { ...previous.preferences, ...patch } } : previous); return; }
    void run(() => bridge!.updatePreferences(patch));
  };
  const openConnect = () => {
    setSelected(null); setPanel('connect');
    if (bridge) void run(async () => { setPreview(await bridge!.previewProvider('claude-code')); });
  };
  const showDiagnostics = () => {
    setPanel('diagnostics');
    if (bridge) void run(async () => { setDiagnostics(await bridge!.getDiagnostics()); });
  };
  const toggleDemo = () => {
    if (bridge) void run(() => bridge!.activateDemoMode(!snapshot?.demoMode));
    else setNotice('This browser is an artwork preview. Open the desktop app for the event-driven demo.');
  };
  const toggleMini = () => {
    if (bridge) void run(() => bridge!.setWindowMode(mini ? 'full' : 'mini'));
    else update({ tankSize: mini ? 'full' : 'mini' });
  };
  const capture = () => {
    if (!bridge) { setNotice('Screenshot export is available in the desktop app.'); return; }
    void run(async () => {
      setCaptureActive(true); setSelected(null); setPanel(null); setNotice('');
      try {
        await bridge!.updatePreferences({ captureMode: true });
        await refresh();
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const result = await bridge!.captureScreenshot();
        setNotice(result.saved ? 'Screenshot saved locally. Capture mode is on.' : 'Screenshot cancelled. Capture mode is on.');
      } finally { setCaptureActive(false); }
    });
  };

  return <main className={`app${mini ? ' mini' : ''}${masked ? ' capture' : ''}${preferences.reducedMotion || systemReduced ? ' reduced-motion' : ''}`} data-theme={preferences.theme} onPointerDown={() => { if (preferences.soundEnabled) enableSound(); }}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Icon name="fish" size={25} /></span><div><h1>agent aquarium<span className="brand-period">.</span></h1><span className="brand-subtitle">A LITTLE LIFE BETWEEN THE LINES</span></div></div>
      <div className="top-actions">
        <span className={`connection-tag${snapshot?.demoMode ? ' demo' : ''}`}><i />{!bridge ? 'ARTWORK PREVIEW' : snapshot?.demoMode ? 'DEMO MODE' : 'LOCAL ONLY'}</span>
        <button className={`icon-button${masked ? ' active' : ''}`} onClick={() => update({ captureMode: !masked })} aria-label={masked ? 'Turn off capture privacy' : 'Turn on capture privacy'} aria-pressed={masked} title="Capture privacy"><Icon name="shield" /></button>
        <button className="icon-button" onClick={capture} disabled={busy} aria-label="Save private screenshot" title="Save screenshot"><Icon name="camera" /></button>
        <button className="icon-button" onClick={toggleMini} disabled={busy} aria-label={mini ? 'Expand tank' : 'Open mini tank'} title={mini ? 'Expand tank' : 'Mini tank'}><Icon name="mini" /></button>
        <button className="icon-button" onClick={() => { setSelected(null); setPanel('settings'); }} aria-label="Open settings" title="Settings"><Icon name="settings" /></button>
      </div>
    </header>

    <section className="tank" aria-label="Agent aquarium">
      <div className="tank-topline"><div className="tank-title"><span className="eyebrow">{snapshot?.demoMode ? 'THE PRACTICE POND' : 'YOUR QUIET CORNER'}</span><h2>{snapshot?.demoMode ? 'A small world, at work.' : 'Let your agents swim.'}</h2><p>{snapshot?.demoMode ? 'Five simulated companions. A glimpse of the flow.' : liveCount ? `${liveCount} ${liveCount === 1 ? 'session' : 'sessions'}, finding their flow.` : 'Your work has a life of its own.'}</p></div>
        <div className="tank-coordinate" aria-hidden="true">01 <span>/</span> DEEP WATER<br /><small>EST. LOCALLY</small></div>
      </div>

      <AquariumScene agents={agents} selected={selected} masked={masked} reduced={preferences.reducedMotion || systemReduced} batterySaver={preferences.batterySaver} onSelect={key => { if (!masked) { setPanel(null); setSelected(key); } }} />

      {snapshot && !agents.length && <div className="welcome-card"><span className="welcome-orbit"><Icon name="fish" size={33} /></span><span className="eyebrow">A HOME FOR YOUR AGENTS</span><h3>Good things take a little time.</h3><p>Connect Claude Code and watch each session become a fish. Just your work, a little more alive.</p><div><button className="primary-button" onClick={openConnect}>Connect Claude Code <Icon name="arrow" size={16} /></button><button className="text-button" onClick={toggleDemo} disabled={busy}><Icon name="play" size={14} /> Watch the demo</button></div><small>No account. No cloud. Just a very nice tank.</small></div>}
      {!snapshot && <div className="welcome-card" role="status"><span className="welcome-orbit"><Icon name="fish" size={33} /></span><h3>Settling the water…</h3><p>Connecting to your local aquarium.</p></div>}

      <div className="tank-caption"><span><i /> {masked ? 'PRIVATE CAPTURE · LABELS HIDDEN' : snapshot?.demoMode ? 'DEMO FISH ARE SIMULATED · EVERYTHING STAYS ON THIS DEVICE' : 'OBSERVING GENTLY · EVERYTHING STAYS ON THIS DEVICE'}</span><span className="tank-hint">{masked ? 'Enjoy the view' : 'Select a fish to say hello'} <span>↗</span></span></div>
      <div className="glass-border" aria-hidden="true" />
    </section>

    {!masked && <section className="session-strip" aria-label="Agent sessions">
      <div className="strip-top"><div className="status-filters" aria-label="Filter sessions">{([['all', 'All fish', agents.length], ['working', 'At work', working], ['waiting', 'Needs you', waiting]] as const).map(([key, label, count]) => <button key={key} className={filter === key ? 'selected' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{count}</span></button>)}</div><button className="text-button demo-button" onClick={toggleDemo} disabled={busy}><Icon name="play" size={13} />{snapshot?.demoMode ? 'Leave demo' : 'Try demo'}</button></div>
      <div className="fish-cards">{visibleAgents.length ? visibleAgents.map(agent => <button className={`fish-card state-${agent.status}${selected === agent.key ? ' selected' : ''}`} key={agent.key} onClick={() => { setPanel(null); setSelected(agent.key); }}>
        <span className="fish-avatar" style={{ '--fish-color': identity(agent).palette.css } as React.CSSProperties}><i /><b /></span><span className="fish-card-copy"><strong>{fishName(agent)} {agent.simulated && <em>DEMO</em>}</strong><small><i />{activity(agent)}</small></span><span className="card-glyph">{agent.status === 'waiting' ? '!' : agent.status === 'turn_done' ? '✓' : agent.status === 'error' ? '×' : '↗'}</span>
      </button>) : <div className="empty-list"><span>Still waters, for now.</span><button className="text-button" onClick={openConnect}>Connect an agent <Icon name="arrow" size={14} /></button></div>}</div>
    </section>}

    <footer className="footer"><span><Icon name="leaf" size={13} /> Made for a calmer kind of focus.</span><span>{!bridge ? 'BROWSER PREVIEW · SIMULATED FISH' : `${snapshot?.demoMode ? 'DEMO' : 'ON DEVICE'} · OPEN SOURCE · NO TELEMETRY`}</span></footer>
    {(error || notice) && <div className={`toast${error ? ' error-toast' : ''}`} role={error ? 'alert' : 'status'}><span>{error || notice}</span>{error && <button className="text-button" onClick={() => void run(refresh)}>Retry</button>}<button className="icon-button" aria-label="Dismiss message" onClick={() => { setError(''); setNotice(''); }}><Icon name="close" size={15} /></button></div>}

    {chosen && !panel && <Sheet title={fishName(chosen)} eyebrow="MEET YOUR FISH" onClose={closePanel}><Inspector agent={chosen} masked={masked} /></Sheet>}
    {panel === 'settings' && <Sheet title="Make yourself at home." eyebrow="TANK PREFERENCES" onClose={closePanel}>
      {!bridge && <p className="info-box">Browser artwork preview. Preferences are temporary; desktop integrations are unavailable here.</p>}
      <h3 className="section-label">The atmosphere</h3>
      <label className="select-row"><span>Water palette</span><select value={preferences.theme} disabled={busy} onChange={event => update({ theme: event.target.value as Preferences['theme'] })}><option value="deep">Deep water</option><option value="reef">Warm reef</option><option value="midnight">Midnight</option></select></label>
      <Toggle label="Reduced motion" detail={systemReduced ? 'Your system also requests reduced motion.' : 'Still plants, gentle fish, fewer particles.'} checked={preferences.reducedMotion || systemReduced} onChange={value => update({ reducedMotion: value })} disabled={busy || systemReduced} />
      <Toggle label="Battery saver" detail="A gentler 30 frames per second." checked={preferences.batterySaver} onChange={value => update({ batterySaver: value })} disabled={busy} />
      <Toggle label="Always on top" detail="Keep a little company above your windows." checked={preferences.alwaysOnTop} onChange={value => update({ alwaysOnTop: value })} disabled={busy || !bridge} />
      <Toggle label="Sound" detail="Quiet cues for attention and completed turns." checked={preferences.soundEnabled} onChange={value => update({ soundEnabled: value })} disabled={busy || !bridge} />
      <Toggle label="Desktop notifications" detail="Attention and completed turns, when permitted." checked={preferences.notificationsEnabled} onChange={value => update({ notificationsEnabled: value })} disabled={busy || !bridge} />
      <h3 className="section-label">Privacy & memory</h3>
      <Toggle label="Capture privacy" detail="Mask project and session labels; hide inspector." checked={preferences.captureMode} onChange={value => update({ captureMode: value })} disabled={busy} />
      <Toggle label="Remember local history" detail="Minimal lifecycle metadata, stored on this device." checked={preferences.historyEnabled} onChange={value => update({ historyEnabled: value })} disabled={busy || !bridge} />
      <label className="select-row"><span>Event history</span><select value={preferences.eventRetentionDays} disabled={busy || !bridge} onChange={event => update({ eventRetentionDays: Number(event.target.value) })}>{[1, 7, 14, 30].map(days => <option key={days} value={days}>{days} days</option>)}</select></label>
      <h3 className="section-label">Connections</h3><button className="connection-row" onClick={openConnect}><span className="provider-mark">✳</span><span><strong>Claude Code</strong><small>Lifecycle hooks · local only</small></span><Icon name="arrow" /></button>
      <div className="settings-links"><button className="text-button" onClick={showDiagnostics}>Open diagnostics <Icon name="arrow" size={14} /></button><button className="text-button danger" disabled={!bridge || busy} onClick={() => setConfirmClear(true)}>Clear local data</button></div>
      {confirmClear && <div className="confirm-box"><p>Remove stored sessions and event history from this device? New events can create fish again.</p><button className="danger-button" disabled={busy} onClick={() => void run(async () => { await bridge!.clearLocalData(); setConfirmClear(false); setNotice('Local session data cleared.'); })}>Clear stored data</button><button className="text-button" onClick={() => setConfirmClear(false)}>Keep it</button></div>}
    </Sheet>}
    {panel === 'connect' && <Sheet title="Let someone swim in." eyebrow="CONNECT CLAUDE CODE" onClose={closePanel}>
      <div className="connect-art"><span className="provider-mark">✳</span><span className="connection-dots">· · · · ·</span><Icon name="fish" size={47} /></div>
      <h3>Your sessions. Their own little fish.</h3><p className="body-copy">Small lifecycle hooks tell the aquarium when a session starts, uses a tool, needs attention, or finishes a turn. Your prompts, code, and tool contents stay out of the water.</p>
      <div className="step-list"><p><span>01</span>Review the exact configuration below.</p><p><span>02</span>Install hooks. Existing settings are backed up and merged.</p><p><span>03</span>Start or resume Claude Code to welcome your first fish.</p></div>
      {preview ? <details className="hook-preview" open><summary>Hook configuration preview</summary><p>{masked ? 'Settings path hidden in capture mode' : preview.settingsPath}</p><pre tabIndex={0}>{masked ? 'Turn off capture privacy to review hook paths before installation.' : typeof preview.preview === 'string' ? preview.preview : JSON.stringify(preview.preview, null, 2)}</pre></details> : <p className="info-box">{bridge ? busy ? 'Preparing the exact hook preview…' : 'The hook preview is unavailable. Retry the connection or check diagnostics.' : 'Open the desktop app to preview and install local hooks.'}</p>}
      <button className="primary-button full-width" disabled={busy || !bridge || !preview || masked} onClick={() => void run(async () => { const result = await bridge!.installProvider('claude-code'); if (!result.ok) throw new Error('Installation failed'); setNotice(result.message || 'Hooks installed. Start or resume a Claude Code session.'); setPanel(null); })}>Approve & install hooks <Icon name="arrow" size={16} /></button>
      <p className="quiet-note"><Icon name="shield" size={15} /> Only Aquarium hooks are added. No permission policy changes.</p>
      <div className="settings-links"><button className="text-button" onClick={showDiagnostics}>Check connection</button><button className="text-button danger" disabled={busy || !bridge} onClick={() => void run(async () => { const result = await bridge!.uninstallProvider('claude-code'); if (!result.ok) throw new Error('Removal failed'); setNotice(result.message || 'Aquarium hooks removed.'); setPreview(await bridge!.previewProvider('claude-code')); })}>Remove Aquarium hooks</button></div>
    </Sheet>}
    {panel === 'diagnostics' && <Sheet title="A look under the water." eyebrow="LOCAL DIAGNOSTICS" onClose={closePanel}>
      <p className="body-copy">A safe connection summary. Authentication tokens and event contents are never shown here.</p>
      {diagnostics ? <><dl className="detail-list"><div><dt>App version</dt><dd>{diagnostics.appVersion}</dd></div><div><dt>Local listener</dt><dd>{diagnostics.listenerRunning ? 'Running' : 'Not running'}</dd></div><div><dt>Claude Code hooks</dt><dd>{diagnostics.providerInstalled ? 'Installed' : 'Not installed'}</dd></div><div><dt>Queued events</dt><dd>{diagnostics.queuedEvents}</dd></div></dl><div className="info-box">{masked ? 'Diagnostic details hidden in capture mode.' : diagnostics.issues.length ? diagnostics.issues.map((issue, index) => <p key={index}>{issue}</p>) : 'Everything looks calm. No connection issues reported.'}</div></> : <p className="info-box">{bridge ? 'Checking the local connection…' : 'Diagnostics are available in the desktop app.'}</p>}
      <button className="secondary-button" disabled={busy || !bridge} onClick={showDiagnostics}><Icon name="refresh" size={16} /> Refresh diagnostics</button>
    </Sheet>}
  </main>;
}

