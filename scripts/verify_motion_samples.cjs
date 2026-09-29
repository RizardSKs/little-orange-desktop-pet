// Requires local Vite. Isolated BrowserWindow uses the actual React RigRenderer, no save API.
const {app,BrowserWindow,screen}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const output=path.resolve('tmp/rig-evidence/motion-samples');
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile'));
const samples=[['item-honey-soda',8000],['item-ribbon-ball',12000],['service-cozy-grooming',20000],['item-mini-keyboard',10000]];
app.whenReady().then(async()=>{
  const window=new BrowserWindow({width:1100,height:800,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const js=source=>window.webContents.executeJavaScript(source);
  const wait=async(predicate,attempts=100)=>{for(let i=0;i<attempts;i++){if(await js(predicate))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Timeout: '+predicate);};
  const results=[],shots=[];
  try {
    for(const stage of ['sprout','lively','mature','radiant'])for(const direction of ['right','left'])for(const [itemId,duration] of samples)for(const time of [400,1500,duration-800,duration-1]) {
      await window.loadURL(`http://127.0.0.1:5173/?view=rig-preview&stage=${stage}&direction=${direction}&action=${itemId}&time=${time}`);
      await js(`new Promise((resolve,reject)=>{let attempts=0;const check=()=>{if(document.querySelector('[data-drawable]'))resolve();else if(attempts++>100)reject(Error('No rendered frame'));else setTimeout(check,30);};check();})`);
      await js('Promise.all([...document.images].map(image=>image.decode()))');
      await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const state=await js(`(()=>{const ids=[...document.querySelectorAll('[data-drawable]')].map(n=>n.dataset.drawable);return {unique:ids.length===new Set(ids).size,prop:ids.includes('action-prop'),saveApiUnavailable:typeof window.orangePet==='undefined'};})()`);
      if(!state.unique||!state.saveApiUnavailable||state.prop!==(time<duration-1))throw Error(JSON.stringify({stage,direction,itemId,time,state}));
      const clip=await js(`(()=>{const r=document.querySelector('[data-preview-viewport]').getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:220,height:220};})()`);
      const png=(await window.webContents.capturePage(clip)).toPNG();
      const name=`${stage}-${direction}-${itemId}-${time}.png`;
      fs.writeFileSync(path.join(output,name),png);results.push({stage,direction,itemId,time,...state});
      if(direction==='right'&&time===1500)shots.push({stage,itemId,src:'data:image/png;base64,'+png.toString('base64')});
    }
    const live=[];
    for(const [itemId] of samples){
      // Mount after the approach safe interval, so initial decode must still commit.
      await window.loadURL(`http://127.0.0.1:5173/?view=rig-preview&fixture=live&stage=lively&action=${itemId}&time=1500`);
      await wait("Boolean(document.querySelector('[data-drawable=action-prop]')) && !document.querySelector('[data-drawable=fallback]')");
      live.push({itemId,lateInitialDecode:true});
    }
    await window.loadURL('http://127.0.0.1:5173/?view=rig-preview&fixture=live&stage=lively&action=item-honey-soda&time=1500');
    await wait("Boolean(document.querySelector('[data-drawable=action-prop]'))");
    await js(`(()=>{const select=document.querySelectorAll('select')[3];select.value='radiant';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await new Promise(resolve=>setTimeout(resolve,150));
    if(await js("document.querySelector('[data-rig-stage]')?.dataset.rigStage!=='lively'"))throw Error('Growth changed during grip');
    await wait("document.querySelector('[data-rig-stage]')?.dataset.rigStage==='radiant'",300);
    if(await js("[...document.images].some(image=>image.src.includes('/pet/lively/'))"))throw Error('Mixed stage after finite action');
    await window.loadURL('about:blank');
    await js(`document.body.style='margin:0;background:#f6efe3;font:14px system-ui';document.body.innerHTML='<main style="display:grid;grid-template-columns:repeat(4,240px)">${shots.map(s=>`<div><p>${s.stage} · ${s.itemId}</p><img width="220" height="220" src="${s.src}"></div>`).join('')}</main>';`);
    await js('Promise.all([...document.images].map(i=>i.decode()))');
    window.setContentSize(960,1160);
    fs.writeFileSync(path.join(output,'四阶段样板.png'),(await window.webContents.capturePage()).toPNG());
    await window.loadURL(pathToFileURL(path.join(output,'小橙子动作样板对比.html')).href);
    await js('Promise.all([...images].map(i=>i.decode()))');
    const offline=await js(`(()=>{document.getElementById('restart').click();return {clips:data.clips.length,local:location.protocol==='file:',saveApiUnavailable:typeof window.orangePet==='undefined'};})()`);
    if(offline.clips!==4||!offline.local||!offline.saveApiUnavailable)throw Error('Offline artifact failed');
    fs.writeFileSync(path.join(output,'renderer-results.json'),JSON.stringify({passed:true,frames:results.length,scaleFactor:screen.getPrimaryDisplay().scaleFactor,offline,live,growthHeldUntilRelease:true,results},null,2));
    console.log(JSON.stringify({passed:true,frames:results.length,offline,live,growthHeldUntilRelease:true}));
    window.destroy();app.exit(0);
  }catch(error){console.error(error);window.destroy();app.exit(1);}
});
