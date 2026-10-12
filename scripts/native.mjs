import { spawn } from 'node:child_process';
import electronPath from 'electron';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
export function run(command,args,options={}){return new Promise(resolve=>{const child=spawn(command,args,{windowsHide:true,stdio:'inherit',...options});child.on('error',()=>resolve(1));child.on('exit',code=>resolve(code??1));});}
export async function ensureElectronNative(){
 if(await run(electronPath,['scripts/native-probe.cjs'],{stdio:'ignore'})!==0){
  console.log('Preparing SQLite for the desktop runtime…');
  if(await run(process.execPath,[require.resolve('electron-builder/cli.js'),'install-app-deps'])!==0)throw new Error('Desktop native dependencies could not be prepared');
 }
}
