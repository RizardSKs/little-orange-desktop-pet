// Run with Electron against an already running local Vite dev server.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('tmp/rig-evidence/phase1');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'electron-profile'));
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 840, height: 640, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    await window.loadURL('http://127.0.0.1:5173/?view=rig-preview');
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
    if (result.count !== 15 || result.unique !== 15 || !result.sameParent || result.handSlot !== 'handFront' || !result.saveApiUnavailable) throw new Error(JSON.stringify(result));
    fs.writeFileSync(path.join(output, 'preview.png'), (await window.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    window.destroy(); app.exit(0);
  } catch (error) { console.error(error); window.destroy(); app.exit(1); }
});
