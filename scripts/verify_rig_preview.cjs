// Run with Electron against an already running local Vite dev server.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const character = process.argv.includes('--character');
const outfits = process.argv.includes('--outfits');
const actions = process.argv.includes('--actions');
const travel = process.argv.includes('--travel');
const actionCases = actions ? [...fs.readFileSync('src/renderer/rig/actions.ts','utf8').matchAll(/'((?:item|service)-[^']+)': \{ cycleMs: (\d+)/g)].map(match=>({id:match[1],cycle:Number(match[2])})) : [{id:'',cycle:1}];
const output = path.resolve(`tmp/rig-evidence/${travel ? 'phase5' : actions ? 'phase4' : outfits ? 'phase3' : character ? 'phase2' : 'phase1'}`);
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'electron-profile'));
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 840, height: 640, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    const results = [];
    for (const stage of ['sprout', 'lively', 'mature', 'radiant']) for (const direction of ['right', 'left']) for (const time of (actions ? [.1,.3,.5,.84] : outfits ? [500] : [499.999, 500, 500.001, 650])) for (const outfit of (outfits ? ['leaf-clip','bow','glasses','top-hat','headphones','scarf','crown','halo'] : [''])) for(const action of actionCases) {
    const travelId=travel?({499.999:'travel-satchel',500:'travel-raincoat',500.001:'travel-star-cape',650:'travel-grand-backpack'}[time]):'';
    await window.loadURL(`http://127.0.0.1:5173/?view=rig-preview&stage=${stage}&direction=${direction}&time=${actions ? time*action.cycle : time}&travel=${travelId}&action=${action.id}&outfit=${outfit}${character || outfits ? '&fixture=character&angle='+({499.999:-82,500:0,500.001:40,650:82}[time]) : ''}`);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await window.webContents.executeJavaScript('Boolean(document.querySelector("[data-drawable]"))')) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const result = await window.webContents.executeJavaScript(`(() => {
      const nodes = [...document.querySelectorAll('[data-drawable]')];
      const ids = nodes.map(node => node.dataset.drawable);
      const hand = nodes.find(node => node.dataset.drawable === 'hand');
      return { count: nodes.length, unique: new Set(ids).size, handSlot: hand?.dataset.slot,
        sameParent: nodes.every(node => node.parentElement === hand?.parentElement),
        saveApiUnavailable: typeof window.orangePet === 'undefined' };
    })()`);
    if (actions || travel) {
      if(result.count !== result.unique || result.count < (travel?8:10) || !result.saveApiUnavailable) throw new Error(JSON.stringify(result));
      await window.webContents.executeJavaScript('Promise.all([...document.images].map(image => image.decode()))');
    } else if (character || outfits) {
      const expected = 7 + (outfits ? (['scarf','top-hat','headphones','crown'].includes(outfit) ? 2 : 1) : 0);
      if (result.count !== expected || result.unique !== expected || !result.saveApiUnavailable) throw new Error(JSON.stringify(result));
      await window.webContents.executeJavaScript('Promise.all([...document.images].map(image => image.decode()))');
    } else if (result.count !== 15 || result.unique !== 15 || !result.sameParent || result.handSlot !== (time < 500 ? 'frontArm' : 'handFront') || !result.saveApiUnavailable) throw new Error(JSON.stringify(result));
    results.push({ stage, direction, time, outfit, action:action.id, ...result });
    await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const clip = await window.webContents.executeJavaScript('(() => { const r = document.querySelector("[data-preview-viewport]").getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),width:220,height:220}; })()');
    fs.writeFileSync(path.join(output, `${stage}-${direction}-${time}${outfit ? '-'+outfit : ''}${action.id ? '-'+action.id : ''}.png`), (await window.webContents.capturePage(clip)).toPNG());
    }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ frames: results.length, passed: true }));
    window.destroy(); app.exit(0);
  } catch (error) { console.error(error); window.destroy(); app.exit(1); }
});
