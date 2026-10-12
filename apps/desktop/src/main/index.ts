import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, Notification, dialog, globalShortcut } from 'electron';
import { join, resolve } from 'node:path';
import { mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { IPC_CHANNELS, preferencesPatchSchema, preferencesSchema, type AquariumEventV1, type AquariumSnapshot } from '@aquarium/protocol';
import { createInitialState, reduceEvent, projectSnapshot } from '@aquarium/domain';
import { aquariumDataDir, installClaude, uninstallClaude, previewClaude, drainSpool, quoteCommandArgument } from '@aquarium/cli';
import { AquariumStore } from './store';
import { startReceiver } from './receiver';

app.setName('Agent Aquarium');
const dataDir=aquariumDataDir();app.setPath('userData',dataDir);
let window:BrowserWindow|null=null;let tray:Tray|null=null;let store:AquariumStore;let receiver:Awaited<ReturnType<typeof startReceiver>>|undefined;
let demo=false;let demoState=createInitialState();let deltaSequence=0;let stopping=false;let timer:ReturnType<typeof setInterval>;let demoStep=0;let lastNotification=0;
const snapshot=():AquariumSnapshot=>({...projectSnapshot(demo?demoState:store.state,Date.now(),store.preferences,demo),sequence:deltaSequence});
function publish(){deltaSequence++;if(window&&!window.isDestroyed())window.webContents.send(IPC_CHANNELS.delta,{version:1,sequence:deltaSequence,snapshot:snapshot()});}
function consume(event:AquariumEventV1){
 if(!store.accept(event))return;publish();
 if(store.preferences.notificationsEnabled&&['attention_required','turn_completed'].includes(event.kind)&&Date.now()-lastNotification>10000&&Notification.isSupported()){
  lastNotification=Date.now();new Notification({title:'Agent Aquarium',body:event.kind==='attention_required'?'An agent needs your attention.':'An agent finished its turn.'}).show();
 }
}
function windowMode(mode:'full'|'mini'){
 if(!window)return;window.setMinimumSize(mode==='mini'?320:700,mode==='mini'?200:460);window.setSize(mode==='mini'?440:1180,mode==='mini'?290:760);window.setAlwaysOnTop(store.preferences.alwaysOnTop);}
function openWindow(){
 if(window&&!window.isDestroyed()){window.show();window.focus();return;}
 window=new BrowserWindow({width:1180,height:760,minWidth:700,minHeight:460,backgroundColor:'#081f2c',title:'Agent Aquarium',autoHideMenuBar:true,webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(url!==window?.webContents.getURL())event.preventDefault();});
 if(!app.isPackaged&&process.env.AQUARIUM_DEV_URL){const url=new URL(process.env.AQUARIUM_DEV_URL);if(url.hostname!=='127.0.0.1')throw new Error('Development server must be local');void window.loadURL(url.toString());}
 else void window.loadFile(join(__dirname,'renderer/index.html'));
 window.on('close',event=>{if(!stopping&&tray){event.preventDefault();window?.hide();}});
 window.on('closed',()=>{window=null;});windowMode(store.preferences.tankSize);
}
const provider=z.literal('claude-code');
function registerIPC(){
 const command=app.isPackaged?`${quoteCommandArgument(process.execPath)} --aquarium-cli`: `${quoteCommandArgument(process.execPath)} ${quoteCommandArgument(join(__dirname,'main.cjs'))} --aquarium-cli`;
 const on=(channel:string,handler:(...args:unknown[])=>unknown)=>ipcMain.handle(channel,(event,...args)=>{
  if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Untrusted IPC sender');return handler(...args);
 });
 on(IPC_CHANNELS.snapshot,()=>snapshot());
 on(IPC_CHANNELS.preferences,(patch)=>{store.setPreferences(preferencesSchema.parse({...store.preferences,...preferencesPatchSchema.parse(patch)}));window?.setAlwaysOnTop(store.preferences.alwaysOnTop);publish();});
 on(IPC_CHANNELS.preview,async(value)=>{provider.parse(value);const result=await previewClaude({command});return {...result,command};});
 on(IPC_CHANNELS.install,async(value)=>{provider.parse(value);return installClaude({command});});
 on(IPC_CHANNELS.uninstall,async(value)=>{provider.parse(value);return uninstallClaude({command});});
 on(IPC_CHANNELS.diagnostics,async()=>{
  let installed=false;try{const preview=await previewClaude({command});installed=!preview.changed;}catch{/* Do not expose settings contents. */}
  let queued=0;try{queued=(await readdir(join(dataDir,'spool'))).filter(file=>file.endsWith('.json')).length;}catch{}
  return {version:1,listenerRunning:!!receiver,providerInstalled:installed,queuedEvents:queued,issues:[],appVersion:app.getVersion()};
 });
 on(IPC_CHANNELS.demo,(enabled)=>{demo=z.boolean().parse(enabled);demoState=createInitialState();demoStep=0;if(demo)advanceDemo();publish();});
 on(IPC_CHANNELS.window,(mode)=>{const checked=z.enum(['full','mini']).parse(mode);store.setPreferences({...store.preferences,tankSize:checked});windowMode(checked);publish();});
 on(IPC_CHANNELS.clear,async()=>{store.clear();demo=false;demoState=createInitialState();await rm(join(dataDir,'spool'),{recursive:true,force:true});publish();});
 on(IPC_CHANNELS.capture,async()=>{
  if(!window||!store.preferences.captureMode)return {saved:false};
  const result=await dialog.showSaveDialog(window,{title:'Save aquarium capture',defaultPath:'agent-aquarium.png',filters:[{name:'PNG image',extensions:['png']}]});
  if(result.canceled||!result.filePath)return {saved:false};await writeFile(result.filePath,(await window.webContents.capturePage()).toPNG());return {saved:true};
 });
}
function advanceDemo(){
 const kinds=['turn_started','tool_started','tool_succeeded','attention_required','turn_completed'] as const;
 for(let i=0;i<5;i++){
  const kind=demoStep===0?'session_started':kinds[(demoStep+i)%kinds.length];
  const event:AquariumEventV1={version:1,eventId:`demo-${demoStep}-${i}`,provider:'custom',sessionId:`demo-${i}`,actorId:'main',kind,occurredAt:Date.now(),projectLabel:'Simulated agent',toolCategory:(['read','write','test','delegate','search']as const)[i],toolUseId:`demo-tool-${i}`,attentionReason:'input'};
  demoState=reduceEvent(demoState,event);
 }
 for(const fish of Object.values(demoState.agents))fish.simulated=true;demoStep++;
}
async function boot(){
 await mkdir(dataDir,{recursive:true,mode:0o700});store=new AquariumStore(join(dataDir,'aquarium.db'));
 receiver=await startReceiver(dataDir,consume);await drainSpool(dataDir,consume);registerIPC();
 const icon=nativeImage.createFromBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#174f61"/><ellipse cx="18" cy="16" rx="9" ry="6" fill="#efb86d"/><path d="M10 16L3 9V23Z" fill="#efb86d"/><circle cx="22" cy="14" r="1.5" fill="#082c39"/></svg>'));
 try{tray=new Tray(icon);tray.setToolTip('Agent Aquarium');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open Aquarium',click:openWindow},{label:'Mini Tank',click:()=>{openWindow();windowMode('mini');}},{type:'separator'},{label:'Quit',click:()=>{stopping=true;app.quit();}}]));tray.on('double-click',openWindow);}catch{tray=null;}
 openWindow();globalShortcut.register('CommandOrControl+Shift+A',()=>{if(window?.isVisible())window.hide();else openWindow();});
 let tick=0;timer=setInterval(()=>{tick++;if(demo&&tick%3===0)advanceDemo();if(tick%60===0){store.prune();void drainSpool(dataDir,consume);}publish();},1000);
}
// The installed executable doubles as the packaged hook host. No GUI or singleton
// is started for this route; cli.cjs has a fail-open hook entry point.
if(process.argv.includes('--aquarium-cli')){
 process.argv=[process.argv[0],join(__dirname,'cli.cjs'),...process.argv.slice(process.argv.indexOf('--aquarium-cli')+1)];require(join(__dirname,'cli.cjs'));
}else if(!app.requestSingleInstanceLock()){app.quit();}
else{
 app.on('second-instance',openWindow);app.on('activate',()=>{if(store)openWindow();});
 app.on('before-quit',()=>{stopping=true;});
 app.on('will-quit',event=>{if(receiver){event.preventDefault();clearInterval(timer);globalShortcut.unregisterAll();const rx=receiver;receiver=undefined;void rx.close().finally(()=>{store.close();app.quit();});}});
 app.on('window-all-closed',()=>{if(!tray)app.quit();});
 app.whenReady().then(boot).catch(()=>{dialog.showErrorBox('Agent Aquarium could not start','Local storage or the event listener could not be opened. Your coding agents are unaffected.');app.quit();});
}
