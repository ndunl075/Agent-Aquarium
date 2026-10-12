import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Text, type Ticker } from 'pixi.js';
// This Pixi compatibility module replaces dynamic code generation with CSP-safe functions.
import 'pixi.js/unsafe-eval';
import type { AgentState } from '@aquarium/protocol';
import { activity, fishName, identity, positionAt } from './model';

interface Props {
  agents: AgentState[];
  selected: string | null;
  masked: boolean;
  reduced: boolean;
  batterySaver: boolean;
  onSelect(key: string): void;
}
interface FishActor {
  root: Container; body: Container; tail: Graphics; fin: Graphics; label: Text;
  badge: Text; halo: Graphics; shadow: Graphics; lastLabel: string; lastStatus: string;
}

function makeFish(agent: AgentState): FishActor {
  const { palette: p, species } = identity(agent);
  const root = new Container();
  const shadow = new Graphics().ellipse(0, 52, 42, 6).fill({ color: 0x02141c, alpha: 0.13 });
  const halo = new Graphics().ellipse(0, 0, 64, 46).stroke({ color: p.light, alpha: 0.6, width: 1 });
  halo.visible = false;
  const body = new Container();
  const tail = new Graphics();
  tail.moveTo(-33, 0).bezierCurveTo(-51, -5, -61, -30, -67, -27)
    .bezierCurveTo(-71, -14, -71, 14, -67, 27)
    .bezierCurveTo(-56, 23, -49, 7, -33, 0).fill(p.dark);
  tail.moveTo(-40, 0).lineTo(-64, -18).moveTo(-40, 0).lineTo(-68, 0).moveTo(-40, 0).lineTo(-64, 18)
    .stroke({ color: p.light, width: 1.2, alpha: 0.48 });
  const dorsal = new Graphics();
  dorsal.moveTo(-24, -12).bezierCurveTo(-21, -36 - species * 5, 7, -43, 28, -15)
    .closePath().fill(p.dark);
  dorsal.moveTo(-16, -21).lineTo(-12, -33).moveTo(-4, -23).lineTo(0, -33)
    .moveTo(8, -24).lineTo(12, -30).stroke({ color: p.light, alpha: 0.36, width: 1 });
  const bellyFin = new Graphics().moveTo(-9, 19).quadraticCurveTo(9, 43, 25, 23).closePath().fill(p.dark);
  const shape = new Graphics();
  const height = species === 1 ? 29 : species === 2 ? 21 : 25;
  shape.ellipse(0, 0, 43, height).fill(p.body);
  shape.ellipse(4, -height * 0.26, 31, height * 0.54).fill({ color: p.light, alpha: 0.4 });
  shape.moveTo(-35, 8).quadraticCurveTo(-5, 33, 32, 9).quadraticCurveTo(7, 21, -35, 8)
    .fill({ color: p.light, alpha: 0.35 });
  if (species === 0) {
    for (const x of [-21, -5, 11]) shape.moveTo(x, -height + 3).quadraticCurveTo(x - 9, 0, x - 2, height - 2)
      .stroke({ color: p.dark, alpha: 0.48, width: 6 });
  } else if (species === 1) {
    for (const [x, y] of [[-24, -5], [-11, -13], [-7, 8], [6, -5], [-24, 11]])
      shape.ellipse(x!, y!, 3.5, 2.5).fill({ color: p.dark, alpha: 0.45 });
  } else {
    shape.moveTo(-33, -3).quadraticCurveTo(-2, -11, 22, -4)
      .stroke({ color: p.light, width: 4, alpha: 0.8 });
  }
  shape.ellipse(29, -6, 8.5, 9.5).fill(0xfff7e5);
  shape.ellipse(32, -5, 4.4, 5.3).fill(0x172d36);
  shape.circle(33, -7, 1.6).fill(0xffffff);
  shape.moveTo(37, 8).quadraticCurveTo(40, 10, 43, 7).stroke({ color: p.dark, width: 1.8 });
  shape.moveTo(19, 3).quadraticCurveTo(13, 9, 20, 15).stroke({ color: p.dark, alpha: 0.65, width: 1.6 });
  const fin = new Graphics().moveTo(3, 5).bezierCurveTo(-6, 0, -22, 9, -14, 19)
    .quadraticCurveTo(-2, 23, 7, 8).closePath().fill(p.dark);
  fin.moveTo(3, 8).lineTo(-11, 12).moveTo(3, 9).lineTo(-7, 17).stroke({ color: p.light, alpha: 0.5, width: 1 });
  body.addChild(tail, dorsal, bellyFin, shape, fin);
  const label = new Text({ text: '', style: { fontFamily: 'Segoe UI, sans-serif', fontSize: 11, fill: 0xdce8e3, letterSpacing: 0.5 } });
  label.anchor.set(0.5); label.y = 47;
  const badge = new Text({ text: '', style: { fontFamily: 'Segoe UI, sans-serif', fontSize: 14, fill: 0xffe2ad, fontWeight: '600' } });
  badge.anchor.set(0.5); badge.y = -49;
  root.addChild(shadow, halo, body, label, badge);
  root.eventMode = 'static'; root.cursor = 'pointer';
  return { root, body, tail, fin, label, badge, halo, shadow, lastLabel: '', lastStatus: '' };
}

function makePlant(x: number, height: number, color: number, variant: number): Container {
  const plant = new Container(); plant.x = x;
  const g = new Graphics();
  for (let i = 0; i < 5; i++) {
    const spread = (i - 2) * 18;
    const h = height * (0.64 + ((i * 7 + variant) % 5) * 0.09);
    g.moveTo(0, 0).bezierCurveTo(spread * 0.3, -h * 0.4, spread * 1.5, -h * 0.68, spread, -h)
      .bezierCurveTo(spread - 28, -h * 0.76, spread - 20, -h * 0.35, 0, 0)
      .fill({ color, alpha: 0.72 + i * 0.04 });
    g.moveTo(0, 0).quadraticCurveTo(spread - 9, -h * 0.45, spread, -h + 8)
      .stroke({ color: 0xa2dac0, alpha: 0.16, width: 1 });
  }
  plant.addChild(g); return plant;
}

function makeCoral(x: number, color: number): Container {
  const root = new Container(); root.x = x;
  const g = new Graphics();
  for (let i = 0; i < 7; i++) {
    const endX = (i - 3) * 12;
    const endY = -30 - (i % 3) * 20;
    g.moveTo(0, 0).quadraticCurveTo(endX * 0.5, -20, endX, endY).stroke({ color, width: 7, cap: 'round' });
    g.moveTo(endX * 0.7, endY * 0.65).lineTo(endX + 10, endY * 0.65 - 9).stroke({ color, width: 5, cap: 'round' });
  }
  root.addChild(g); return root;
}

export function AquariumScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = host.current!;
    const app = new Application();
    let disposed = false;
    let initialized = false;
    let resizeObserver: ResizeObserver | undefined;
    let contextLost: (() => void) | undefined;
    const actors = new Map<string, FishActor>();
    const plants: { root: Container; phase: number; foreground: boolean }[] = [];
    const onVisibility = () => {
      if (initialized) app.ticker.maxFPS = document.hidden ? 3 : latest.current.batterySaver || latest.current.reduced ? 30 : 60;
    };

    void (async () => {
      try {
        await app.init({ backgroundAlpha: 0, resizeTo: element, antialias: true,
          autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2),
          preference: 'webgl', powerPreference: 'low-power' });
        initialized = true;
        if (disposed) { app.destroy(true, { children: true }); return; }
        element.appendChild(app.canvas);
        app.canvas.setAttribute('aria-hidden', 'true');
        contextLost = () => { setFailed(true); app.stop(); };
        app.canvas.addEventListener('webglcontextlost', contextLost);
        const scenery = new Container();
        const seaFloor = new Graphics();
        const backPlants = new Container();
        const motes = new Container();
        const fishLayer = new Container();
        const frontPlants = new Container();
        app.stage.addChild(scenery, backPlants, seaFloor, motes, fishLayer, frontPlants);
        const rocks = new Graphics(); scenery.addChild(rocks);
        for (let i = 0; i < 16; i++) {
          const foreground = i > 11;
          const root = makePlant(0, 90 + ((i * 43) % 145),
            [0x245755, 0x316f60, 0x3b8268, 0x215851][i % 4]!, i);
          (foreground ? frontPlants : backPlants).addChild(root);
          plants.push({ root, phase: i * 0.71, foreground });
        }
        const coralLeft = makeCoral(0, 0xb98278);
        const coralRight = makeCoral(0, 0xb89c6e);
        frontPlants.addChild(coralLeft, coralRight);
        const particles = Array.from({ length: 42 }, (_, i) => {
          const node = new Graphics();
          const radius = i % 4 === 0 ? 2.5 : 0.7 + (i % 3) * 0.4;
          if (i % 4 === 0) node.circle(0, 0, radius).stroke({ color: 0xc0eee1, alpha: 0.3, width: 0.7 });
          else node.circle(0, 0, radius).fill({ color: 0xb8dbcb, alpha: 0.13 + (i % 3) * 0.07 });
          motes.addChild(node);
          return { node, startX: ((i * 137.508) % 1000) / 1000, startY: ((i * 73.19) % 1000) / 1000, speed: 0.007 + (i % 5) * 0.002 };
        });
        const layout = () => {
          const w = element.clientWidth, h = element.clientHeight;
          if (w < 1 || h < 1) return;
          app.renderer.resize(w, h);
          seaFloor.clear();
          seaFloor.moveTo(0, h - 32).bezierCurveTo(w * 0.3, h - 70, w * 0.68, h - 15, w, h - 57)
            .lineTo(w, h).lineTo(0, h).closePath().fill(0x2c4140);
          seaFloor.moveTo(0, h - 15).bezierCurveTo(w * 0.4, h - 54, w * 0.75, h - 12, w, h - 31)
            .lineTo(w, h).lineTo(0, h).closePath().fill(0x46544a);
          for (let i = 0; i < 110; i++) seaFloor.ellipse((i * 137.3) % w, h - 7 - (i * 13.7) % 27, 1.2 + i % 3, 0.7)
            .fill({ color: i % 2 ? 0x9a9670 : 0x162c2d, alpha: 0.3 });
          rocks.clear();
          for (const [x, scale] of [[0.14, 1], [0.8, 1.4], [0.9, 0.7]]) {
            const rx = w * x!, ry = h - 26, s = scale! * Math.min(1, w / 800);
            rocks.moveTo(rx - 72 * s, ry).lineTo(rx - 50 * s, ry - 32 * s).lineTo(rx - 15 * s, ry - 44 * s)
              .lineTo(rx + 47 * s, ry - 32 * s).lineTo(rx + 80 * s, ry).closePath().fill(0x345252);
            rocks.moveTo(rx - 50 * s, ry - 32 * s).lineTo(rx - 15 * s, ry - 44 * s).lineTo(rx + 47 * s, ry - 32 * s)
              .lineTo(rx + 14 * s, ry - 23 * s).closePath().fill(0x476461);
          }
          plants.forEach(({ root, foreground }, i) => {
            const ratio = foreground ? [0.035, 0.12, 0.91, 0.98][i - 12]! : [0.015, 0.07, 0.18, 0.25, 0.72, 0.81, 0.9, 0.98, 0.055, 0.86, 0.94, 0.15][i]!;
            root.position.set(w * ratio, h - (foreground ? 4 : 25));
            root.scale.set(Math.min(1.25, Math.max(0.45, h / 600)) * (foreground ? 1.1 : 0.85));
          });
          coralLeft.position.set(w * 0.22, h - 15); coralRight.position.set(w * 0.83, h - 20);
          coralLeft.scale.set(Math.min(1, w / 750)); coralRight.scale.set(Math.min(1, w / 750));
        };
        resizeObserver = new ResizeObserver(layout); resizeObserver.observe(element); layout();
        let elapsed = 0;
        let lastAgents: AgentState[] | null = null;
        app.ticker.add((ticker: Ticker) => {
          const current = latest.current;
          elapsed += Math.min(ticker.deltaMS, 50) / 1000;
          app.ticker.maxFPS = document.hidden ? 3 : current.batterySaver || current.reduced ? 30 : 60;
          const { width: w, height: h } = app.screen;
          if (lastAgents !== current.agents) {
            lastAgents = current.agents;
            const keys = new Set(current.agents.map(a => a.key));
            for (const [key, actor] of actors) if (!keys.has(key)) { actor.root.destroy({ children: true }); actors.delete(key); }
            for (const agent of current.agents) if (!actors.has(agent.key)) {
              const actor = makeFish(agent);
              actor.root.on('pointertap', () => latest.current.onSelect(agent.key));
              actors.set(agent.key, actor); fishLayer.addChild(actor.root);
            }
          }
          for (const [i, agent] of current.agents.entries()) {
            const actor = actors.get(agent.key)!;
            const pos = positionAt(agent, elapsed, i, current.agents.length, current.reduced);
            const scale = (agent.parentKey ? 0.64 : 1) * Math.min(1.18, Math.max(0.5, w / 1050)) * (current.agents.length > 12 ? 0.75 : 1);
            const topInset = h < 350 ? 65 : 165;
            const swimHeight = Math.max(80, h - topInset - 75);
            actor.root.position.set(w * pos.x, topInset + ((pos.y - 0.2) / 0.55) * swimHeight);
            actor.root.scale.set(scale);
            actor.body.scale.x = pos.direction;
            actor.body.rotation = current.reduced ? 0 : pos.angle;
            actor.tail.scale.y = current.reduced ? 1 : 0.86 + Math.sin(elapsed * 4 + pos.phase) * 0.14;
            actor.fin.rotation = current.reduced ? 0 : Math.sin(elapsed * 3 + pos.phase) * 0.12;
            actor.root.alpha = agent.status === 'stale' ? 0.55 : agent.status === 'ended' ? 0.45 : 1;
            actor.halo.visible = current.selected === agent.key;
            const label = `${fishName(agent, current.masked)}${agent.simulated ? ' · DEMO' : ''}`;
            if (actor.lastLabel !== label) { actor.label.text = label; actor.lastLabel = label; }
            const indicator = agent.status === 'waiting' ? '!  NEEDS YOU' : agent.status === 'error' ? '×  ERROR'
              : agent.status === 'turn_done' ? '✓  DONE' : agent.status === 'stale' ? '?  UNKNOWN'
              : agent.status === 'starting' ? '↗  ARRIVING' : agent.status === 'using_tool' ? activity(agent).toUpperCase() : '';
            if (actor.lastStatus !== indicator) { actor.badge.text = indicator; actor.lastStatus = indicator; }
          }
          for (const plant of plants) plant.root.skew.x = current.reduced ? 0 : Math.sin(elapsed * 0.38 + plant.phase) * 0.025;
          particles.forEach((p, i) => {
            p.node.visible = !current.reduced || i < 8;
            p.node.x = p.startX * w + (current.reduced ? 0 : Math.sin(elapsed * 0.3 + i) * 10);
            p.node.y = ((p.startY - (current.reduced ? 0 : elapsed * p.speed)) % 1 + 1) % 1 * h;
          });
        });
        document.addEventListener('visibilitychange', onVisibility); onVisibility();
      } catch (error) {
        console.warn('Aquarium renderer initialization failed:', error instanceof Error ? error.message : 'Unknown rendering error');
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (initialized) {
        if (contextLost) app.canvas.removeEventListener('webglcontextlost', contextLost);
        app.destroy(true, { children: true });
      }
    };
  }, []);

  return <div className="scene-wrap">
    <div className="light-shafts" aria-hidden="true"><i /><i /><i /></div>
    <div ref={host} className="pixi-host" />
    {failed && <div className="gpu-fallback" role="status">
      <span className="eyebrow">Gentle mode</span><h2>Your agents, still in view.</h2>
      <p>Animated rendering is unavailable. Live session information is available below.</p>
      <div className="fallback-fish">{props.agents.map(agent => <button key={agent.key} onClick={() => props.onSelect(agent.key)}>
        <span style={{ color: identity(agent).palette.css }}>◁●</span>{fishName(agent, props.masked)}<small>{activity(agent)}{agent.simulated ? ' · DEMO' : ''}</small>
      </button>)}</div>
    </div>}
  </div>;
}
