// Real React frames and LivePet playback in an isolated, hidden Electron window.
const { app, BrowserWindow, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const output = path.resolve('tmp/rig-evidence/care');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile'));
const actions = { feed: 6000, play: 7000, clean: 6000, 'sleep-in': 4000, 'sleep-loop': 18000, wake: 3000 };
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1100, height: 900, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  const js = code => window.webContents.executeJavaScript(code);
  const wait = async predicate => { for (let i = 0; i < 160; i++) { if (await js(predicate)) return; await new Promise(r => setTimeout(r, 25)); } throw Error('Timeout: ' + predicate); };
  const frames = [], shots = [], live = [];
  try {
    for (const stage of ['sprout', 'lively', 'mature', 'radiant']) for (const [action, duration] of Object.entries(actions)) {
      for (const fraction of [.2, .4, .65, .85]) {
        await window.loadURL(`http://127.0.0.1:5173/?view=rig-preview&stage=${stage}&action=${action}&time=${duration * fraction}`);
        await wait("Boolean(document.querySelector('[data-drawable]'))");
        await js('Promise.all([...document.images].map(i=>i.decode()))');
        const ids = await js("[...document.querySelectorAll('[data-drawable]')].map(n=>n.dataset.drawable)");
        if (ids.length !== new Set(ids).size) throw Error('Duplicate drawable');
        const clip = await js("(()=>{const r=document.querySelector('[data-preview-viewport]').getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:220,height:220};})()");
        const png = (await window.webContents.capturePage(clip)).toPNG();
        const name = `${stage}-${action}-${fraction}.png`;
        fs.writeFileSync(path.join(output, name), png);
        frames.push({ stage, action, fraction, count: ids.length });
        if (fraction === .4) shots.push({ name: `${stage} · ${action}`, src: `data:image/png;base64,${png.toString('base64')}` });
      }
    }
    for (const [action, duration] of Object.entries(actions)) {
      await window.loadURL(`http://127.0.0.1:5173/?view=rig-preview&fixture=live&stage=lively&action=${action}&time=${action === 'wake' ? 300 : 1500}`);
      await wait(action === 'wake'
        ? "Boolean(document.querySelector('[data-rig-stage=lively]')) && !document.querySelector('[data-drawable=fallback]')"
        : "Boolean(document.querySelector('[data-drawable=action-prop]')) && !document.querySelector('[data-drawable=fallback]')");
      if (await js("typeof window.orangePet!=='undefined'")) throw Error('Preview has save access');
      live.push({ action, actualLivePet: true, lateDecode: true, propRequired: action !== 'wake' });
    }
    await window.loadURL('http://127.0.0.1:5173/?view=rig-preview&fixture=live&stage=lively&action=feed&time=1500');
    await wait("Boolean(document.querySelector('[data-drawable=action-prop]'))");
    await js("(()=>{const s=document.querySelectorAll('select')[3];s.value='radiant';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await new Promise(r => setTimeout(r, 150));
    if (await js("document.querySelector('[data-rig-stage]')?.dataset.rigStage!=='lively'")) throw Error('Care changed stage during contact');
    // Wait across the finite deadline; assets commit together at the authored safe boundary.
    await new Promise(r => setTimeout(r, 4500));
    await wait("document.querySelector('[data-rig-stage]')?.dataset.rigStage==='radiant'");
    if (await js("[...document.images].some(i=>i.src.includes('/pet/lively/'))")) throw Error('Mixed care stage');
    await window.loadURL('about:blank');
    await js(`document.body.style='margin:0;background:#f6efe3;font:14px system-ui';document.body.innerHTML=${JSON.stringify('<main style="display:grid;grid-template-columns:repeat(6,230px)">' + shots.map(s => `<div><p>${s.name}</p><img width="220" height="220" src="${s.src}"></div>`).join('') + '</main>')}`);
    window.setContentSize(1380, 1120);
    await js('Promise.all([...document.images].map(i=>i.decode()))');
    fs.writeFileSync(path.join(output, '四阶段基础动作.png'), (await window.webContents.capturePage()).toPNG());
    await window.loadURL(pathToFileURL(path.join(output, '小橙子四项互动预览.html')).href);
    await wait("document.getElementById('time').textContent.includes('秒')");
    const offline = [];
    for (const [action, duration] of Object.entries(actions)) {
      const snapshots = [];
      for (const progress of [.18, .65]) {
        snapshots.push(await js(`(async()=>{const a=document.getElementById('action');a.value=${JSON.stringify(action)};a.dispatchEvent(new Event('change'));const s=document.getElementById('seek');s.max=${duration};s.value=${duration * progress};s.dispatchEvent(new Event('input'));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return document.querySelector('canvas').toDataURL();})()`));
      }
      if (snapshots[0] === snapshots[1] && action !== 'sleep-loop') throw Error('No visible animation: ' + action);
      offline.push({ action, distinctFrames: snapshots[0] !== snapshots[1] });
    }
    if (await js("typeof window.orangePet!=='undefined' || location.protocol!=='file:'")) throw Error('Offline isolation failed');
    fs.writeFileSync(path.join(output, 'renderer-results.json'), JSON.stringify({ passed: true, actualScaleFactor: screen.getPrimaryDisplay().scaleFactor, frames, live, offline, growthHeldUntilRelease: true }, null, 2));
    console.log(JSON.stringify({ passed: true, frames: frames.length, live, offline }));
    window.destroy(); app.exit(0);
  } catch (error) { console.error(error); window.destroy(); app.exit(1); }
});
