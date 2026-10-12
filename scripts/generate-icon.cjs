const { app,BrowserWindow }=require('electron');
const fs=require('node:fs/promises');const path=require('node:path');
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const window=new BrowserWindow({width:512,height:512,useContentSize:true,frame:false,show:false,transparent:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true}});
 const svg=(await fs.readFile(path.resolve('assets/aquarium.svg'),'utf8')).replace('width="256" height="256"','width="512" height="512"');
 let painted;
 window.webContents.on('paint',(_event,_rectangle,image)=>{if(!image.isEmpty())painted=image;});
 await window.loadURL('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));
 window.webContents.invalidate();await new Promise(resolve=>setTimeout(resolve,500));
 if(!painted)throw new Error('Icon did not render');
 await fs.writeFile(path.resolve('assets/aquarium.png'),painted.toPNG());
 app.quit();
}).catch(error=>{console.error(error.message);app.exit(1);});
