import { _electron as electron } from '@playwright/test';
import electronPath from 'electron';
import { ensureElectronNative } from '../native.mjs';
import { mkdir,readFile,writeFile,rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
await ensureElectronNative();
const directory=resolve('.local/performance');await mkdir(directory,{recursive:true});const dataDir=resolve(directory,`data-${Date.now()}`);await mkdir(dataDir,{recursive:true});
const app=await electron.launch({executablePath:electronPath,args:[resolve('apps/desktop/dist/main.cjs')],env:{...process.env,AGENT_AQUARIUM_DATA_DIR:dataDir,CLAUDE_CONFIG_DIR:dataDir}});
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>!!window.aquarium);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1920,1080));
 const connection=JSON.parse(await readFile(resolve(dataDir,'connection.json'),'utf8'));const latencies=[];
 for(let i=0;i<30;i++){
  const start=performance.now();const response=await fetch(`http://127.0.0.1:${connection.port}/events`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${connection.token}`},body:JSON.stringify({version:1,eventId:`stress-${i}`,provider:'custom',sessionId:`stress-session-${i}`,actorId:'main',kind:'turn_started',occurredAt:Date.now()})});if(response.status!==202)throw new Error('Stress event rejected');
  await page.waitForFunction(count=>document.querySelectorAll('.fish-card').length>=count,i+1);latencies.push(performance.now()-start);
 }
 await page.waitForTimeout(300);
 const warmLatencies=[];
 for(let i=0;i<30;i++){
  const start=performance.now();const response=await fetch(`http://127.0.0.1:${connection.port}/events`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${connection.token}`},body:JSON.stringify({version:1,eventId:`warm-${i}`,provider:'custom',sessionId:`stress-session-${i}`,actorId:'main',kind:'tool_started',toolCategory:'read',toolUseId:`read-${i}`,occurredAt:Date.now()})});if(response.status!==202)throw new Error('Warm event rejected');
  await page.waitForFunction(index=>document.querySelectorAll('.fish-card')[index]?.textContent.toLowerCase().includes('reading'),i);warmLatencies.push(performance.now()-start);
 }
 await app.evaluate(({app})=>app.getAppMetrics());
 const frames=await page.evaluate(()=>new Promise(resolveResult=>{const values=[];let last=performance.now();const frame=now=>{values.push(now-last);last=now;if(values.length>=180)resolveResult(values);else requestAnimationFrame(frame);};requestAnimationFrame(frame);}));
 const sort=values=>[...values].sort((a,b)=>a-b);const quantile=(values,p)=>sort(values)[Math.min(values.length-1,Math.floor(values.length*p))];
 const metrics=await app.evaluate(({app})=>app.getAppMetrics().map(metric=>({type:metric.type,memoryKB:metric.memory.workingSetSize,cpuPercent:metric.cpu.percentCPUUsage})));
 const summary=values=>({samples:values.length,meanMs:values.reduce((a,b)=>a+b,0)/values.length,p95Ms:quantile(values,.95)});
 const result={date:new Date().toISOString(),platform:process.platform,fish:30,window:[1920,1080],coldFishCreationToDOM:summary(latencies),warmToolDeliveryToDOM:summary(warmLatencies),foregroundRAF:{samples:frames.length,p50Ms:quantile(frames,.5),p95Ms:quantile(frames,.95)},processes:metrics,limitations:['Local Windows workstation only; not representative of weaker hardware.','RAF cadence measures browser presentation opportunities, not GPU render completion.','Delivery measurement includes test-driver scheduling and DOM synchronization.','Short run is not a sustained memory or battery benchmark.']};
 await page.screenshot({path:resolve(directory,'thirty-fish.png')});await writeFile(resolve(directory,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await app.close();await rm(dataDir,{recursive:true,force:true});}
