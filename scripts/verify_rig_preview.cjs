// Run with Electron against an already running local Vite dev server.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const character = process.argv.includes('--character');
const output = path.resolve(`tmp/rig-evidence/${character ? 'phase2' : 'phase1'}`);
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'electron-profile'));
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 840, height: 640, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    const results = [];
    for (const stage of ['sprout', 'lively', 'mature', 'radiant']) for (const direction of ['right', 'left']) for (const time of [499.999, 500, 500.001, 650]) {
    await window.loadURL(`http://127.0.0.1:5173/?view=rig-preview&stage=${stage}&direction=${direction}&time=${time}${character ? '&fixture=character&angle='+({499.999:-82,500:0,500.001:40,650:82}[time]) : ''}`);
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
    if (character) {
      if (result.count !== 6 || result.unique !== 6 || !result.saveApiUnavailable) throw new Error(JSON.stringify(result));
      await window.webContents.executeJavaScript('Promise.all([...document.images].map(image => image.decode()))');
    } else if (result.count !== 15 || result.unique !== 15 || !result.sameParent || result.handSlot !== (time < 500 ? 'frontArm' : 'handFront') || !result.saveApiUnavailable) throw new Error(JSON.stringify(result));
    results.push({ stage, direction, time, ...result });
    await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    fs.writeFileSync(path.join(output, `${stage}-${direction}-${time}.png`), (await window.webContents.capturePage()).toPNG());
    }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ frames: results.length, passed: true }));
    window.destroy(); app.exit(0);
  } catch (error) { console.error(error); window.destroy(); app.exit(1); }
});
