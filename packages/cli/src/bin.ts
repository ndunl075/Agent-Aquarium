#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { normalizeClaudeEvent, normalizeCodexNotification } from '@aquarium/adapters';
import { aquariumEventSchema } from '@aquarium/protocol';
import { aquariumDataDir, claudeSettingsPath, forwardEvent, installClaude, uninstallClaude, previewClaude, installStatusBridge, runStatusBridge, readConnection } from './index.js';
const args=process.argv.slice(2), isHook=args[0]==='hook', isStatus=args[0]==='status-bridge';
function stdin(limit=1024*1024,timeout=700):Promise<string> {return new Promise((resolve,reject)=>{let body='',size=0;const timer=setTimeout(()=>{process.stdin.pause();reject(new Error('Input timeout'));},timeout);process.stdin.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>limit){clearTimeout(timer);process.stdin.pause();reject(new Error('Input too large'));}else body+=chunk.toString('utf8');});process.stdin.on('end',()=>{clearTimeout(timer);resolve(body);});process.stdin.on('error',error=>{clearTimeout(timer);reject(error);});});}
async function main():Promise<void> {
  if(isHook){
    let event;
    if(args[1]==='claude')event=normalizeClaudeEvent(JSON.parse(await stdin()));
    else if(args[1]==='codex') {const input=args[2]??await stdin();if(Buffer.byteLength(input)>1024*1024)return;event=normalizeCodexNotification(JSON.parse(input));}
    if(event)await forwardEvent(event);return;
  }
  if(isStatus){if(args[1]==='claude')await runStatusBridge(await stdin());return;}
  if((args[0]==='install'||args[0]==='uninstall')&&args[1]==='claude'){
    const remove=args[0]==='uninstall';
    const launch={executable:process.execPath,args:[path.resolve(process.argv[1])]};
    if(!remove && !args.includes('--yes')) {const p=await previewClaude(launch);console.log(`Preview for ${p.settingsPath}\n${p.preview}\nRun this CLI with install claude --yes to apply. Add --status-line to opt in to context metrics.`);return;}
    const result=remove?await uninstallClaude(launch):await installClaude(launch);console.log(result.message);if(!result.ok)process.exitCode=1;
    if(args.includes('--status-line')||remove){const status=await installStatusBridge(launch,remove);console.log(status.message);if(!status.ok)process.exitCode=1;}return;
  }
  if(args[0]==='emit') {if(args.includes('--help')){console.log('Pipe one normalized v1 custom-provider JSON event into agent-aquarium emit. See docs/protocol.md.');return;}const event=aquariumEventSchema.parse(JSON.parse(await stdin(16384,5000)));if(event.provider!=='custom')throw new Error('emit requires provider custom');console.log(await forwardEvent(event));return;}
  if(args[0]==='doctor') {
    const dataDir=aquariumDataDir();let listenerRunning=false;try{const c=await readConnection(dataDir);listenerRunning=await new Promise<boolean>(resolve=>{const socket=import('node:net').then(({connect})=>{const s=connect(c.port,'127.0.0.1');s.setTimeout(150);s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));s.once('timeout',()=>{s.destroy();resolve(false);});});void socket;});}catch{}
    let providerInstalled=false;try{const s=await fs.readFile(claudeSettingsPath(),'utf8');providerInstalled=s.includes('Agent Aquarium observer');}catch{}
    const queuedEvents=(await fs.readdir(path.join(dataDir,'spool')).catch(()=>[])).filter(f=>f.endsWith('.json')).length;
    console.log(JSON.stringify({version:1,listenerRunning,providerInstalled,queuedEvents,appVersion:'0.1.0',issues:listenerRunning?[]:['Desktop is closed or discovery is stale.']},null,2));return;
  }
  if(args[0]==='open') {const command=process.platform==='win32'?'cmd.exe':process.platform==='darwin'?'open':'xdg-open';const commandArgs=process.platform==='win32'?['/c','start','','agent-aquarium://open']:['agent-aquarium://open'];await new Promise<void>((resolve,reject)=>{const child=spawn(command,commandArgs,{detached:true,stdio:'ignore',windowsHide:true});child.on('error',reject);child.once('spawn',()=>{child.unref();resolve();});});return;}
  console.log('Agent Aquarium\n  install claude [--yes] [--status-line]\n  uninstall claude\n  doctor\n  open\n  emit --help');
}
// The deadline also bounds stdin and stalled filesystem calls. No hook output reaches Claude.
const deadline=(isHook||isStatus)?setTimeout(()=>process.exit(0),isStatus?1600:1200):undefined;
main().catch(()=>{if(!isHook&&!isStatus){console.error('Agent Aquarium command failed. Check settings and run doctor.');process.exitCode=1;}}).finally(()=>{if(deadline)clearTimeout(deadline);if(isHook||isStatus)process.exit(0);});
