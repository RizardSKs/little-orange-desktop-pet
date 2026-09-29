// Isolated, hidden LivePet comparison. Development-mode measurements are observations, not release gates.
const {app,BrowserWindow,screen}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const output=path.resolve('tmp/rig-evidence/motion-samples');
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'benchmark-profile'));
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
// Vite resolves these imports normally, so both revisions share one React runtime.
fs.writeFileSync(path.join(output,'benchmark-entry.ts'),`import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {LivePet as Current} from '/src/renderer/rig/live-pet';
import {LivePet as Previous} from '/tmp/motion-baseline/src/renderer/rig/live-pet';
import {findInventoryItem} from '/src/shared/catalog';
let root;
export function mount(version,itemId){root?.unmount();document.getElementById('benchmark-root')?.remove();const node=document.createElement('div');node.id='benchmark-root';node.style='position:absolute;left:28px;top:49px';document.body.append(node);root=createRoot(node);const item=itemId?findInventoryItem(itemId):null;root.render(createElement(version==='before'?Previous:Current,{stage:'lively',outfit:null,travel:null,expression:item?.useVisual.expression??'neutral',direction:'right',intensity:'normal',dragVisual:{current:undefined},runtime:{motion:{moving:false,direction:'right'},interaction:{kind:item?'inventory-use':'idle',inventoryItemId:item?.id??null,sequenceId:1,startedAt:Date.now(),durationMs:item?.useVisual.durationMs??null,direction:'right'},gaze:{x:0,y:0},keyboardStatus:'disabled',keyboardTempo:'calm'}}));}
`);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  const window=new BrowserWindow({width:600,height:500,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:true}});
  window.webContents.setFrameRate(60);
  window.webContents.on('console-message',event=>{if(event.level==='error')console.error(event.message);});
  const js=source=>window.webContents.executeJavaScript(source);
  try {
    await window.loadURL('http://127.0.0.1:5173/?view=rig-preview&fixture=character');
    await js(`(async()=>{window.assetErrors=[];document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement)window.assetErrors.push({id:event.target.dataset.drawable,src:event.target.src});},true);window.benchmark=await import('/tmp/rig-evidence/motion-samples/benchmark-entry.ts');document.getElementById('root').style.display='none';})()`);
    const results=[];
    for(const itemId of [null,'item-honey-soda','item-ribbon-ball','service-cozy-grooming','item-mini-keyboard','service-grand-festival'])for(const version of ['before','current']){
      await js(`Promise.all(['torso','leaves','arm-left','arm-right','leg-left','leg-right','segment','hand','mouth-delighted','mouth-refreshed',...['neutral','happy','curious','surprised','proud','focused','delighted','excited','refreshed','asleep','sad','sleepy','hungry','uncomfortable'].map(id=>'expressions/'+id)].map(file=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.decode().then(resolve,reject);image.onerror=()=>reject(Error('Asset '+file));image.src='/assets/pet/lively/'+file+'.png';})))`);
      await js(`window.benchmark.mount(${JSON.stringify(version)},${JSON.stringify(itemId)});`);
      await pause(700);
      const pid=window.webContents.getOSProcessId();
      const start=app.getAppMetrics().find(m=>m.pid===pid);
      const result=await js(`new Promise(resolve=>{const intervals=[];let previous=performance.now();const begin=previous;function tick(now){intervals.push(now-previous);previous=now;if(now-begin<3000)requestAnimationFrame(tick);else {intervals.sort((a,b)=>a-b);resolve({durationMs:now-begin,frames:intervals.length,medianFrameMs:intervals[Math.floor(intervals.length*.5)],p95FrameMs:intervals[Math.floor(intervals.length*.95)],maxFrameMs:intervals.at(-1),drawables:document.querySelectorAll('#benchmark-root [data-drawable]').length,saveApiUnavailable:typeof window.orangePet==='undefined'});}}requestAnimationFrame(tick);})`);
      const end=app.getAppMetrics().find(m=>m.pid===pid);
      if(!result.saveApiUnavailable||result.drawables<7)throw Error(JSON.stringify({itemId,version,result,assetErrors:await js('window.assetErrors'),html:await js("document.getElementById('benchmark-root')?.innerHTML.slice(0,1000)")}));
      results.push({itemId:itemId??'idle',version,...result,cpuSecondsDelta:start?.cpu.cumulativeCPUUsage!=null&&end?.cpu.cumulativeCPUUsage!=null?end.cpu.cumulativeCPUUsage-start.cpu.cumulativeCPUUsage:null,memoryBefore:start?.memory,memoryAfter:end?.memory});
    }
    fs.writeFileSync(path.join(output,'live-performance.json'),JSON.stringify({environment:{scaleFactor:screen.getPrimaryDisplay().scaleFactor,electron:process.versions.electron,platform:process.platform,hidden:true,offscreen:true,frameRate:60,backgroundThrottling:false,build:'Vite development'},note:'One short run per case, baseline then current, shared process and caches; does not prove long-run stability, drag response, or packaged performance.',results},null,2));
    console.log(JSON.stringify({cases:results.length,passed:true}));window.destroy();app.exit(0);
  }catch(error){console.error(error);window.destroy();app.exit(1);}
});
