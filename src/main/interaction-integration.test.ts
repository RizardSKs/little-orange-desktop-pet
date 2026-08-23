import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('desktop lock and native input boundaries', () => {
  it('makes the pet click-through while locked and restores the saved topmost preference', () => {
    const main = read('src/main/main.ts');
    expect(main).toContain('petWindow?.setIgnoreMouseEvents(true)');
    expect(main).toContain('petWindow?.setIgnoreMouseEvents(false)');
    expect(main).toContain("petWindow?.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating')");
    expect(main).toContain("serviceName: '小橙子键盘节奏'");
  });

  it('validates pet gesture and unlock IPC senders', () => {
    const main = read('src/main/main.ts');
    expect(main).toContain('event.sender !== petWindow.webContents');
    expect(main).toContain('event.sender !== unlockWindow.webContents');
    expect(main).toContain('!interactionController?.isDragging()');
  });

  it('keeps the keyboard worker payload aggregate-only', () => {
    const worker = read('src/main/keyboard-worker.ts');
    expect(worker).toContain("{ type: 'key-bucket', count, endedAt: Date.now() }");
    expect(worker).not.toMatch(/keycode|rawcode|keychar|window(title|name)/i);
    expect(worker).not.toContain('console.');
  });

  it('uses a dedicated minimal unlock preload', () => {
    const preload = read('src/preload/unlock.ts');
    expect(preload).toContain("ipcRenderer.invoke('desktop-lock:unlock')");
    expect(preload).not.toContain('state:load');
    expect(preload).not.toContain('settings:set');
  });

  it('pauses actual runtime only for system suspend while screen lock pauses native input', () => {
    const main = read('src/main/main.ts');
    expect(main).toContain("powerMonitor.on('suspend', onSuspend)");
    expect(main).toContain("powerMonitor.on('lock-screen', onLockScreen)");
    expect(main).toContain("powerMonitor.on('resume', onResume)");
    expect(main).toContain('pauseActualRuntimeForSuspend();');
    expect(main).toContain('state = settleOffline(state, Date.now()).state');
    const lockBlock = main.slice(main.indexOf('const onLockScreen'), main.indexOf('const onResume'));
    expect(lockBlock).toContain('pauseNativeInput();');
    expect(lockBlock).not.toContain('pauseActualRuntimeForSuspend();');
    const unlockBlock = main.slice(main.indexOf('const onUnlockScreen'), main.indexOf("powerMonitor.on('suspend'"));
    expect(unlockBlock).not.toContain('settleOffline');
  });

  it('stops runtime services before windows are destroyed during quit', () => {
    const main = read('src/main/main.ts');
    expect(main).toContain('function requestQuit(): void');
    expect(main).toContain('function stopRuntimeServices(): void');
    expect(main).toContain('runtimeScheduler?.stop()');
    expect(main).toContain("app.on('before-quit', () => {");
    const quitBlock = main.slice(main.indexOf("app.on('before-quit'"), main.indexOf("if (!app.requestSingleInstanceLock())"));
    expect(quitBlock.indexOf('stopRuntimeServices();')).toBeLessThan(quitBlock.indexOf('store.save(state)'));
    expect(main).toContain("petWindow.on('closed', () => { petWindow = null; })");
  });

  it('keeps economy mutations panel-only and advances only actual runtime', () => {
    const main = read('src/main/main.ts');
    for (const channel of ['economy:item-purchase', 'economy:item-use', 'expedition:start', 'expedition:return', 'expedition:ack']) {
      expect(main).toContain(`ipcMain.handle('${channel}'`);
    }
    expect(main).toContain('assertPanelRequest(event)');
    expect(main).toContain('advanceEconomyRuntime(state.economy, elapsedRuntimeMs, now)');
    expect(main).toContain('if (advanceActualEconomyRuntime(now)) saveAndBroadcast()');
    const itemUse = main.slice(main.indexOf("ipcMain.handle('economy:item-use'"), main.indexOf("ipcMain.handle('expedition:start'"));
    expect(itemUse).toContain('if (!economyResult.ok)');
    expect(itemUse).toContain('interactionController?.playInventoryUse(itemId, item.useVisual.durationMs)');
  });

  it('exposes only the validated economy channels through the regular preload', () => {
    const preload = read('src/preload/preload.ts');
    for (const channel of ['economy:item-purchase', 'economy:item-use', 'expedition:start', 'expedition:return', 'expedition:ack']) {
      expect(preload).toContain(`ipcRenderer.invoke('${channel}'`);
    }
  });

  it('bootstraps state atomically and exposes growth sources without an offline source', () => {
    const main = read('src/main/main.ts');
    const preload = read('src/preload/preload.ts');
    const growth = read('src/shared/growth.ts');
    expect(main).toContain("ipcMain.handle('state:bootstrap'");
    expect(main).toContain("growthProgress('online'");
    expect(main).toContain("growthProgress('care'");
    expect(preload).toContain("ipcRenderer.invoke('state:bootstrap')");
    expect(preload).toContain("ipcRenderer.on('growth:progress'");
    expect(growth).toContain("source: 'online' | 'care'");
    expect(growth).not.toContain("source: 'online' | 'offline' | 'care'");
  });
});
