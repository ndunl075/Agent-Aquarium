import { contextBridge,ipcRenderer } from 'electron';
import { IPC_CHANNELS, snapshotSchema,deltaSchema,preferencesPatchSchema, installResultSchema,safeDiagnosticsSchema,type AquariumDesktopAPI } from '@aquarium/protocol';
const api:AquariumDesktopAPI={
 getSnapshot:async()=>snapshotSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.snapshot)),
 onDelta:(callback)=>{const listener=(_event:Electron.IpcRendererEvent,value:unknown)=>{const checked=deltaSchema.safeParse(value);if(checked.success)callback(checked.data);};ipcRenderer.on(IPC_CHANNELS.delta,listener);return()=>ipcRenderer.removeListener(IPC_CHANNELS.delta,listener);},
 updatePreferences:async patch=>{await ipcRenderer.invoke(IPC_CHANNELS.preferences,preferencesPatchSchema.parse(patch));},
 previewProvider:provider=>ipcRenderer.invoke(IPC_CHANNELS.preview,provider),
 installProvider:async provider=>installResultSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.install,provider)),
 uninstallProvider:async provider=>installResultSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.uninstall,provider)),
 getDiagnostics:async()=>safeDiagnosticsSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.diagnostics)),
 activateDemoMode:async enabled=>{await ipcRenderer.invoke(IPC_CHANNELS.demo,enabled);},
 setWindowMode:async mode=>{await ipcRenderer.invoke(IPC_CHANNELS.window,mode);},
 clearLocalData:async()=>{await ipcRenderer.invoke(IPC_CHANNELS.clear);},
 captureScreenshot:()=>ipcRenderer.invoke(IPC_CHANNELS.capture),
 checkForUpdates:()=>ipcRenderer.invoke(IPC_CHANNELS.updates),
};
contextBridge.exposeInMainWorld('aquarium',Object.freeze(api));
