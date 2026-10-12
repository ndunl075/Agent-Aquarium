import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { claudeSettingsPath } from './paths.js';
export interface ClaudeInstallOptions { settingsPath?: string; command?: string; statusBridge?: boolean }
export interface InstallResult { ok:boolean; changed:boolean; message:string; restartRequired?:boolean; preview?:string }
const EVENTS = ['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','PostToolUseFailure','PermissionRequest','Notification','SubagentStart','SubagentStop','Stop','StopFailure','SessionEnd'];
type Settings=Record<string,any>;
const MARKER='Agent Aquarium observer';
function own(handler:any):boolean {return handler?.type==='command' && handler?.statusMessage===MARKER && typeof handler.command==='string' && handler.command.endsWith(' hook claude');}
function validate(settings:unknown):asserts settings is Settings {
  if(!settings || typeof settings!=='object' || Array.isArray(settings)) throw new Error('Claude settings must be a JSON object');
  const hooks=(settings as Settings).hooks; if(hooks!==undefined && (!hooks || typeof hooks!=='object'||Array.isArray(hooks))) throw new Error('Invalid hooks configuration');
  for(const groups of Object.values(hooks??{})) { if(!Array.isArray(groups)) throw new Error('Invalid hook groups'); for(const group of groups) if(!group || typeof group!=='object'||!Array.isArray(group.hooks)) throw new Error('Invalid hook handlers'); }
}
async function read(file:string):Promise<{settings:Settings;raw:string|null}> { try { const stat=await fs.stat(file); if(stat.size>1024*1024) throw new Error('Settings too large'); const raw=await fs.readFile(file,'utf8'); const settings=JSON.parse(raw); validate(settings); return {settings,raw}; } catch(error:any) {if(error.code==='ENOENT')return {settings:{},raw:null}; throw error;} }
function transform(settings:Settings,options:ClaudeInstallOptions,remove=false):Settings {
  const next=structuredClone(settings); next.hooks??={};
  for(const name of Object.keys(next.hooks)) { next.hooks[name]=next.hooks[name].map((group:any)=>({...group,hooks:group.hooks.filter((handler:any)=>!own(handler))})).filter((group:any)=>group.hooks.length); if(!next.hooks[name].length)delete next.hooks[name]; }
  if(!remove) for(const name of EVENTS) { next.hooks[name]??=[]; next.hooks[name].push({...(name==='Notification'?{matcher:'permission_prompt|idle_prompt|elicitation_dialog|elicitation_url_dialog|agent_needs_input'}:{}),hooks:[{type:'command',command:`${options.command??'agent-aquarium'} hook claude`,timeout:2,statusMessage:MARKER}]}); }
  if(!Object.keys(next.hooks).length)delete next.hooks;
  return next;
}
export async function previewClaude(options:ClaudeInstallOptions={}):Promise<{settingsPath:string;preview:string;changed:boolean}> { const file=options.settingsPath??claudeSettingsPath(); const {settings}=await read(file); const next=transform(settings,options); return {settingsPath:file,preview:JSON.stringify(next,null,2)+'\n',changed:JSON.stringify(settings)!==JSON.stringify(next)}; }
async function update(options:ClaudeInstallOptions,remove:boolean):Promise<InstallResult> {
  const file=options.settingsPath??claudeSettingsPath(), lock=`${file}.aquarium-lock`; await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
  try{await fs.mkdir(lock);}catch{return {ok:false,changed:false,message:'Settings are being edited; retry shortly.'};}
  let tmp:string|undefined;
  try {
    const {settings,raw}=await read(file), next=transform(settings,options,remove); validate(next);
    if(JSON.stringify(settings)===JSON.stringify(next))return {ok:true,changed:false,message:remove?'Claude hooks already removed.':'Claude hooks already installed.'};
    const output=JSON.stringify(next,null,2)+'\n'; validate(JSON.parse(output));
    if(raw!==null) await fs.writeFile(`${file}.aquarium-backup-${Date.now()}-${randomUUID()}`,raw,{mode:0o600,flag:'wx'});
    tmp=`${file}.${randomUUID()}.tmp`; await fs.writeFile(tmp,output,{mode:0o600,flag:'wx'});
    // Detect a concurrent external editor before atomic replacement.
    const latest=await read(file); if(latest.raw!==raw)throw new Error('Settings changed during installation; retry.');
    await fs.rename(tmp,file);
    return {ok:true,changed:true,message:remove?'Removed Agent Aquarium hooks.':'Installed Agent Aquarium hooks. Restart or resume Claude sessions to load them.',restartRequired:true};
  } catch {return {ok:false,changed:false,message:'Claude settings could not be safely edited. Existing settings were preserved.'};}
  finally{if(tmp)await fs.unlink(tmp).catch(()=>{});await fs.rmdir(lock).catch(()=>{});}
}
export function installClaude(options:ClaudeInstallOptions={}):Promise<InstallResult> {return update(options,false);}
export function uninstallClaude(options:ClaudeInstallOptions={}):Promise<InstallResult> {return update(options,true);}
export function quoteCommandArgument(value:string,platform=process.platform):string {if(/[\r\n\0]/.test(value))throw new Error('Invalid executable path'); return platform==='win32'?`"${value.replace(/"/g,'""')}"`:`'${value.replace(/'/g,"'\\''")}'`;}
