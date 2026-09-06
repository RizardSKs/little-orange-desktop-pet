const {app,BrowserWindow,screen}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const factor=process.argv.find(arg=>arg.startsWith('--dpi='))?.split('=')[1];
if(factor)app.commandLine.appendSwitch('force-device-scale-factor',factor);
const output=path.resolve(`tmp/rig-evidence/phase6-${factor??'native'}`);
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
 const window=new BrowserWindow({width:840,height:640,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 const js=source=>window.webContents.executeJavaScript(source);
 const wait=async predicate=>{for(let i=0;i<120;i++){if(await js(predicate))return;await pause(50);}throw Error('Timeout: '+predicate);};
 const select=async(index,value)=>js(`(()=>{const node=document.querySelectorAll('select')[${index}];node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const capture=async name=>{
  await js('Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))');
  await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const clip=await js('(()=>{const r=document.querySelector("[data-preview-viewport]").getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:220,height:220};})()');
  fs.writeFileSync(path.join(output,name+'.png'),(await window.webContents.capturePage(clip)).toPNG());
 };
 try{
  await window.loadURL('http://127.0.0.1:5173/?view=rig-preview&fixture=live&stage=sprout&outfit=glasses&action=item-citrus-cookie&time=700');
  await wait('Boolean(document.querySelector("[data-drawable=body]"))');
  await wait('Boolean(document.querySelector("[data-drawable=action-prop]"))');
  await capture('loaded');
  await select(3,'radiant');
  await wait('document.querySelector("[data-rig-stage]")?.dataset.rigStage==="radiant"');
  const mixed=await js('[...document.images].some(image=>image.src.includes("/pet/sprout/"))');
  if(mixed)throw Error('Mixed committed stage assets');
  await capture('stage-committed');
  window.webContents.session.webRequest.onBeforeRequest({urls:['http://127.0.0.1:5173/assets/outfits/travel/*']},(_details,callback)=>callback({cancel:true}));
  await select(2,'travel-raincoat');
  await wait('!document.querySelector("[data-drawable^=outfit-]")');
  if(await js('Boolean(document.querySelector("[data-drawable^=travel-]"))'))throw Error('Failed travel partially visible');
  await capture('failed-travel');
  window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await pause(150);await capture('reduced');
  const unique=await js('(()=>{const ids=[...document.querySelectorAll("[data-drawable]")].map(n=>n.dataset.drawable);return ids.length===new Set(ids).size;})()');
  if(!unique)throw Error('Duplicate drawable ownership');
  const result={passed:true,unique,mixedStage:false,failedTravelHidden:true,saveApiUnavailable:await js('typeof window.orangePet==="undefined"'),scaleFactor:screen.getPrimaryDisplay().scaleFactor,scaleSource:factor?'Chromium emulation':'host display'};
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  window.destroy();app.exit(0);
 }catch(error){console.error(error);window.destroy();app.exit(1);}
});
