// Windows portable launcher needs CDP attachment rather than Electron launch pipes.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,readFile,rm,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
if(process.platform!=='win32')throw new Error('Run portable acceptance on Windows.');
const directory=resolve('.local',`portable-check-${Date.now()}`);await mkdir(directory,{recursive:true});
let child,browser;
const environment={...process.env,AGENT_AQUARIUM_DATA_DIR:directory,CLAUDE_CONFIG_DIR:directory};
async function launch(){
 await rm(resolve(directory,'DevToolsActivePort'),{force:true});
 child=spawn(resolve('release/Agent Aquarium 0.1.0.exe'),['--remote-debugging-port=0'],{windowsHide:true,stdio:'ignore',env:environment});
 let port;for(let i=0;i<150;i++){try{port=Number((await readFile(resolve(directory,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(port,'Portable debug endpoint appears');
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);const page=browser.contexts()[0].pages()[0];await page.waitForFunction(()=>!!window.aquarium);return page;
}
async function close(){
 if(browser){await browser.close();browser=undefined;}
 if(child){const pid=child.pid;await new Promise(r=>{const kill=spawn('taskkill.exe',['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});kill.on('close',r);kill.on('error',r);});child=undefined;}
}
async function hookEvent(hook,id){return new Promise((res,rej)=>{const h=spawn(hook.command,hook.args,{windowsHide:true,stdio:['pipe','pipe','pipe'],env:environment});let output='';const timer=setTimeout(()=>{h.kill();rej(new Error('Portable hook deadline exceeded'));},4000);h.stdout.on('data',b=>output+=b);h.stderr.on('data',b=>output+=b);h.on('error',rej);h.on('close',code=>{clearTimeout(timer);res({code,output});});h.stdin.end(JSON.stringify({hook_event_name:'SessionStart',session_id:id}));});}
try{
 let page=await launch();assert.equal((await page.evaluate(()=>window.aquarium.getSnapshot())).agents.length,0);
 await page.evaluate(()=>window.aquarium.activateDemoMode(true));await page.waitForFunction(()=>document.querySelectorAll('.fish-card').length===5);await page.screenshot({path:resolve('.local/desktop-smoke/portable.png')});await page.evaluate(()=>window.aquarium.activateDemoMode(false));
 assert.equal((await page.evaluate(()=>window.aquarium.installProvider('claude-code'))).ok,true);const settings=JSON.parse(await readFile(resolve(directory,'settings.json'),'utf8'));const hook=settings.hooks.SessionStart[0].hooks[0];assert.ok(hook.command.startsWith(resolve(directory,'companion')));
 assert.deepEqual(await hookEvent(hook,'portable-live-session'),{code:0,output:''});await page.waitForFunction(()=>document.querySelectorAll('.fish-card').length===1);
 await close();await access(hook.command);await access(hook.args[0]);assert.deepEqual(await hookEvent(hook,'portable-closed-session'),{code:0,output:''});
 page=await launch();await page.waitForFunction(()=>document.querySelectorAll('.fish-card').length===2);const snapshot=await page.evaluate(()=>window.aquarium.getSnapshot());assert.equal(snapshot.agents.some(agent=>agent.sessionId==='portable-closed-session'),true);
 assert.equal((await page.evaluate(()=>window.aquarium.uninstallProvider('claude-code'))).ok,true);await page.evaluate(()=>window.aquarium.clearLocalData());assert.equal((await page.evaluate(()=>window.aquarium.getSnapshot())).agents.length,0);
 const evidence={ok:true,checks:['actual portable extraction and launch','offline five-fish demo','stable configured portable companion','silent hook while desktop open','silent queued hook after portable closes','spool replay after new extraction','uninstall','clear data'],limitation:'Development workstation, not a clean account.'};await writeFile(resolve('.local/portable-results.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await close();await rm(directory,{recursive:true,force:true}).catch(()=>{});}
