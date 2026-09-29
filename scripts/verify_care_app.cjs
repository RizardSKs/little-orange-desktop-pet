// Runs the compiled application with a dedicated save folder; never uses the user's save.
const { app, BrowserWindow, Menu, powerMonitor } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('tmp/rig-evidence/care-app');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(output, 'profile-'));
app.setPath('userData', profile);
const { createDefaultSave } = require('../dist-electron/shared/game.js');
const seed = createDefaultSave(Date.now());
seed.pet.stats = { satiety: 10, mood: 10, energy: 90, cleanliness: 10 };
seed.economy.coins = 200; seed.settings.autoWalk = false;
seed.settings.mouseInteractionsEnabled = false;
seed.economy.inventory['item-ribbon-ball'] = 2;
fs.writeFileSync(path.join(profile, 'save.json'), JSON.stringify(seed));
app.on('browser-window-created', (_event, window) => {
  window.webContents.setBackgroundThrottling(false);
});
require('../dist-electron/main/main.js');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const results = [];
  const assert = (condition, label) => { if (!condition) throw Error(label); results.push(label); };
  let pet, panel;
  try {
    for (let i = 0; i < 200; i++) {
      const windows = BrowserWindow.getAllWindows();
      pet = windows.find(w => w.webContents.getURL().includes('view=pet'));
      panel = windows.find(w => w.webContents.getURL().includes('view=panel'));
      if (pet && panel && await panel.webContents.executeJavaScript("Boolean(window.orangePet && document.querySelector('button'))")) break;
      await delay(50);
    }
    if (!pet || !panel) throw Error('Application windows unavailable');
    for (let i = 0; i < 100; i++) {
      if (await pet.webContents.executeJavaScript("Boolean(document.querySelector('[data-drawable=body]')) && !document.querySelector('[data-drawable=fallback]')")) break;
      await delay(50);
    }
    const api = expression => panel.webContents.executeJavaScript(expression);
    const action = (kind, id, sleepTarget) => api(`window.orangePet.performAction(${JSON.stringify(kind)},${JSON.stringify({ id, sleepTarget })})`);
    const current = () => api('window.orangePet.loadState()');
    const runtime = () => api('window.orangePet.loadRuntimeState()');
    const first = await action('feed', 'feed-1');
    assert(first.ok && first.state.economy.coins === 195, 'feed commits one cost through preload and IPC');
    const sequence = (await runtime()).interaction.sequenceId;
    await action('feed', 'feed-1');
    assert((await runtime()).interaction.sequenceId === sequence && (await current()).economy.coins === 195, 'retry does not charge or replay');
    assert((await action('feed', 'feed-2')).code === 'busy', 'second active feed rejected');
    await delay(1500);
    assert(await pet.webContents.executeJavaScript("Boolean(document.querySelector('[data-drawable=action-prop]')) && !document.querySelector('[data-drawable=fallback]')"), 'actual pet renders local care assets');
    fs.writeFileSync(path.join(output, 'feed.png'), (await pet.webContents.capturePage()).toPNG());
    await action('play', 'play-1');
    await action('clean', 'clean-1');
    assert((await runtime()).interaction.careAction === 'clean', 'different successful care replaces prior care');
    await api("window.orangePet.useInventoryItem('item-ribbon-ball')");
    assert((await runtime()).interaction.kind === 'inventory-use', 'inventory replaces care');
    await action('sleep', 'sleep-1', 'asleep');
    assert((await current()).pet.behavior === 'sleeping', 'sleep intent commits immediately');
    await delay(4200);
    assert((await runtime()).interaction.careAction === 'sleep-loop', 'entry transitions into persistent sleeping');
    assert(await pet.webContents.executeJavaScript("document.querySelectorAll('[data-drawable=action-prop]').length===1 && !document.querySelector('[data-drawable^=exit-]')"), 'sleep entry leaves one pillow');
    const sleepFrames = await pet.webContents.executeJavaScript("new Promise(resolve=>{const times=[];let last;function tick(t){if(last!==undefined)times.push(t-last);last=t;if(times.length===180)resolve(times);else requestAnimationFrame(tick);}requestAnimationFrame(tick);})");
    const sorted = [...sleepFrames].sort((a, b) => a - b);
    const performance = { samples: sorted.length, medianFrameMs: sorted[Math.floor(sorted.length * .5)], p95FrameMs: sorted[Math.floor(sorted.length * .95)],
      processes: app.getAppMetrics().map(p => ({ type: p.type, cpuPercent: p.cpu.percentCPUUsage, workingSetKB: p.memory.workingSetSize })) };
    await pet.webContents.executeJavaScript('window.orangePet.beginPetDrag()');
    assert((await action('feed', 'drag-feed')).code === 'busy', 'dragging refuses consumption');
    await pet.webContents.executeJavaScript('window.orangePet.endPetDrag()');
    await delay(900);
    assert((await current()).pet.behavior === 'sleeping' && (await runtime()).interaction.careAction === 'sleep-loop', 'landing preserves logical sleep');
    const sleepMenu = Menu.getApplicationMenu().items.find(item => item.label === '宠物').submenu.items.find(item => item.label.includes('叫醒'));
    sleepMenu.click();
    assert((await current()).pet.behavior === 'idle' && (await runtime()).interaction.careAction === 'wake', 'application menu uses unified wake intent');
    await delay(3200);
    assert((await runtime()).interaction.kind === 'idle', 'wake ends without old sleep resurrection');
    await action('clean', 'suspend-clean');
    powerMonitor.emit('suspend'); await delay(50); powerMonitor.emit('resume'); await delay(100);
    assert((await runtime()).interaction.kind !== 'care', 'suspend invalidates the short presentation');
    const saved = JSON.parse(fs.readFileSync(path.join(profile, 'save.json'), 'utf8'));
    assert(saved.schemaVersion === 2 && saved.economy.coins === 195, 'isolated saved schema and cost remain intact');
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed: true, results, performance, profile, simulatedPowerEvents: true, packagedInstaller: false }, null, 2));
    console.log(JSON.stringify({ passed: true, checks: results.length, output }));
    app.quit();
  } catch (error) {
    if (pet) console.error(await pet.webContents.executeJavaScript("Promise.all(['bowl','bread'].map(name=>new Promise(resolve=>{const i=new Image();i.onload=()=>i.decode().then(()=>resolve({name,ok:true,src:i.src}),()=>resolve({name,decode:false}));i.onerror=()=>resolve({name,ok:false,src:i.src});i.src='../assets/props/rig/care/'+name+'.png';})))"));
    if (pet) console.error(await pet.webContents.executeJavaScript("(async()=>({runtime:await window.orangePet.loadRuntimeState(),class:document.querySelector('.pet-character')?.className,ids:[...document.querySelectorAll('[data-drawable]')].map(n=>n.dataset.drawable),images:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src)}))()"));
    console.error(error); app.exit(1);
  }
});
