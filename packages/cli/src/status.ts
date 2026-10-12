import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { normalizeClaudeStatus } from '@aquarium/adapters';
import { forwardEvent } from './transport.js';
import { aquariumDataDir, claudeSettingsPath } from './paths.js';
import type { ClaudeInstallOptions, InstallResult } from './installer.js';
const bridgeSuffix=' status-bridge claude';
const encodedMarker='Agent Aquarium status bridge v1';
function psLiteral(value:string):string {return `'${value.replace(/'/g,"''")}'`;}
function windowsArgument(value:string):string {return `"${value.replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/,'$1$1')}"`;}
/** StatusLine has a shell command, unlike hooks' native argument-vector form. */
export function statusBridgeCommand(options:ClaudeInstallOptions={},platform=process.platform):string {
  if(!options.executable)return `${options.command??'agent-aquarium'}${bridgeSuffix}`;
  const executable=options.executable, args=[...(options.args??[]),'status-bridge','claude'];
  if([executable,...args].some(value=>typeof value!=='string'||/[\0\r\n]/.test(value)))throw new Error('Invalid bridge launch configuration');
  if(platform!=='win32')return [executable,...args].map(value=>`'${value.replace(/'/g,"'\\''")}'`).join(' ');
  // Only fixed PowerShell syntax enters the shell; paths live inside UTF-16LE
  // encoded literal strings. .NET bypasses cmd/Git Bash re-tokenization.
  const script=`$ProgressPreference='SilentlyContinue'; try { $null=${psLiteral(encodedMarker)}; $s=[System.Diagnostics.ProcessStartInfo]::new(); $s.FileName=${psLiteral(executable)}; $s.Arguments=${psLiteral(args.map(windowsArgument).join(' '))}; $s.UseShellExecute=$false; $s.CreateNoWindow=$true; $s.RedirectStandardInput=$true; $s.RedirectStandardOutput=$true; $p=[System.Diagnostics.Process]::new(); $p.StartInfo=$s; $null=$p.Start(); [Console]::OpenStandardInput().CopyTo($p.StandardInput.BaseStream); $p.StandardInput.Close(); $p.StandardOutput.BaseStream.CopyTo([Console]::OpenStandardOutput()); $p.WaitForExit(); } catch {} ; exit 0`;
  return `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${Buffer.from(script,'utf16le').toString('base64')}`;
}
function isBridgeCommand(command:string):boolean {
  if(command.includes(bridgeSuffix) || /(?:^|[\s'"])status-bridge[\s'"]+claude(?:$|[\s'"])/.test(command))return true;
  const encoded=command.match(/-EncodedCommand\s+([A-Za-z0-9+/=]+)/i)?.[1];
  return !!encoded && Buffer.from(encoded,'base64').toString('utf16le').includes(encodedMarker);
}
export async function installStatusBridge(options:ClaudeInstallOptions={},remove=false):Promise<InstallResult> {
  const file=options.settingsPath??claudeSettingsPath(), backup=`${file}.aquarium-status.json`,lock=`${file}.aquarium-lock`; let tmp:string|undefined, createdBackup=false, published=false;
  await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
  try{await fs.mkdir(lock);}catch{return {ok:false,changed:false,message:'Settings busy; retry.'};}
  try {
    let raw:string;try{raw=await fs.readFile(file,'utf8');}catch(e:any){if(e.code!=='ENOENT')throw e;raw='{}';}
    if(Buffer.byteLength(raw)>1024*1024)throw new Error(); const s=JSON.parse(raw); if(!s || typeof s!=='object'||Array.isArray(s))throw new Error();
    const command=statusBridgeCommand(options);
    let saved:any;try{saved=JSON.parse(await fs.readFile(backup,'utf8'));}catch{}
    if(remove) { if(!saved || s.statusLine?.command!==saved.wrapper)return {ok:true,changed:false,message:'Status line was independently changed; preserved.'}; if(saved.previous===null)delete s.statusLine; else s.statusLine=saved.previous; }
    else { if(saved && s.statusLine?.command===saved.wrapper)return {ok:true,changed:false,message:'Status bridge already installed.'}; if(saved || isBridgeCommand(String(s.statusLine?.command??'')))throw new Error(); if(s.statusLine && (s.statusLine.type!=='command'||typeof s.statusLine.command!=='string'))throw new Error(); saved={wrapper:command,previous:s.statusLine??null};await fs.writeFile(backup,JSON.stringify(saved),{mode:0o600,flag:'wx'}); createdBackup=true; s.statusLine={type:'command',command}; }
    await fs.writeFile(`${file}.aquarium-backup-${randomUUID()}`,raw,{mode:0o600,flag:'wx'});
    tmp=`${file}.${randomUUID()}.tmp`;await fs.writeFile(tmp,JSON.stringify(s,null,2)+'\n',{mode:0o600,flag:'wx'});if(await fs.readFile(file,'utf8').catch(()=>'{}')!==raw)throw new Error();await fs.rename(tmp,file); published=true;
    if(remove)await fs.unlink(backup).catch(()=>{});
    return {ok:true,changed:true,message:remove?'Restored previous status line.':'Enabled opt-in status bridge; previous output is preserved.',restartRequired:true};
  }catch{return {ok:false,changed:false,message:'Status line could not be safely changed; existing settings preserved.'};}
  finally{if(tmp)await fs.unlink(tmp).catch(()=>{});if(createdBackup&&!published)await fs.unlink(backup).catch(()=>{});await fs.rmdir(lock).catch(()=>{});}
}
export async function runStatusBridge(input:string,options:{settingsPath?:string;dataDir?:string}={}):Promise<void> {
  const dataDir=options.dataDir??aquariumDataDir();
  try {
    const saved=JSON.parse(await fs.readFile(`${options.settingsPath??claudeSettingsPath()}.aquarium-status.json`,'utf8'));
    const original=saved.previous?.command;
    if(typeof original==='string' && !isBridgeCommand(original) && process.env.AGENT_AQUARIUM_STATUS_ACTIVE!=='1') {
      await new Promise<void>(resolve=>{
        const child=spawn(original,{shell:true,windowsHide:true,stdio:['pipe','pipe','ignore'],env:{...process.env,AGENT_AQUARIUM_STATUS_ACTIVE:'1'}});
        const timer=setTimeout(()=>{child.kill();resolve();},700); child.on('error',()=>{clearTimeout(timer);resolve();});child.on('close',()=>{clearTimeout(timer);resolve();});child.stdout.on('data',chunk=>process.stdout.write(chunk));child.stdin.on('error',()=>{});child.stdin.end(input);
      });
    }
  }catch{}
  try {
    const event=normalizeClaudeStatus(JSON.parse(input));if(!event)return;
    const dir=path.join(dataDir,'status-throttle');await fs.mkdir(dir,{recursive:true,mode:0o700});
    const file=path.join(dir,createHash('sha256').update(event.sessionId).digest('hex'));
    try{const stat=await fs.stat(file);if(Date.now()-stat.mtimeMs<2000)return;}catch{}
    await fs.writeFile(file,'',{mode:0o600});await forwardEvent(event,{dataDir});
  }catch{}
}
