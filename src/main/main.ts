import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, powerMonitor, screen, Tray, utilityProcess, type UtilityProcess } from 'electron';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { advanceOnline, buyItem, performAction, settleOffline, statCap } from '../shared/game';
import { deriveGrowthMilestones, type GrowthProgressEvent } from '../shared/growth';
import { findShopItem } from '../shared/catalog';
import {
  acknowledgeExpeditionReward,
  advanceEconomyRuntime,
  applyInventoryStatEffect,
  MAX_PURCHASE_QUANTITY,
  purchaseInventoryItem,
  returnExpeditionEarly,
  startExpedition,
  useInventoryItem,
} from '../shared/economy';
import { isExpeditionId, isInventoryItemId, type EconomyActionCode } from '../shared/economy-types';
import type { AnimationIntensity, EconomyIpcResult, OfflineSummary, PetAction, PetBehavior, PetPosition, PetRuntimeState, SaveData, SettingKey } from '../shared/types';
import { SaveStore } from './store';
import { createMotionPlan, positionAt } from './motion';
import { InteractionController } from './interaction-controller';

const execFileAsync = promisify(execFile);
const PET_SIZE = 220;
const PANEL_WIDTH = 390;
const PANEL_HEIGHT = 620;
const UNLOCK_SIZE = 40;
const KEYBOARD_CONSENT_VERSION = 1;
const VALID_ACTIONS = new Set<PetAction>(['feed', 'play', 'clean', 'sleep']);
const VALID_INTENSITIES = new Set<AnimationIntensity>(['gentle', 'normal', 'lively']);

let petWindow: BrowserWindow | null = null;
let panelWindow: BrowserWindow | null = null;
let unlockWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let store: SaveStore;
let state: SaveData;
let startupOfflineSummary: OfflineSummary;
let quitting = false;
let foregroundFullscreen = false;
let systemSuspended = false;
let screenLocked = false;
let runtimeBaselineAt: number | null = null;
let actionResetTimer: NodeJS.Timeout | null = null;
let motionTimer: NodeJS.Timeout | null = null;
let motionToken = 0;
let motionDirection: 'left' | 'right' = 'right';
let motionMoving = false;
let motionRestoreBehavior: PetBehavior = 'idle';
let interactionController: InteractionController | null = null;
let keyboardWorker: UtilityProcess | null = null;
let keyboardReadyTimer: NodeJS.Timeout | null = null;

const preloadPath = path.join(__dirname, '..', 'preload', 'preload.js');
const unlockPreloadPath = path.join(__dirname, '..', 'preload', 'unlock.js');
const keyboardWorkerPath = path.join(__dirname, 'keyboard-worker.js');
const rendererPath = path.join(__dirname, '..', '..', 'dist', 'index.html');

function windowOptions() {
  return {
    preload: preloadPath,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
  } as const;
}

async function loadView(window: BrowserWindow, view: 'pet' | 'panel') {
  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) await window.loadURL(`${process.env.VITE_DEV_SERVER_URL}/?view=${view}`);
  else await window.loadFile(rendererPath, { query: { view } });
}

function defaultPetPosition(): PetPosition {
  const workArea = screen.getPrimaryDisplay().workArea;
  return { x: workArea.x + workArea.width - PET_SIZE - 24, y: workArea.y + workArea.height - PET_SIZE - 12 };
}

function clampPosition(position: PetPosition): PetPosition {
  const display = screen.getDisplayNearestPoint(position);
  const area = display.workArea;
  return {
    x: Math.round(Math.min(area.x + area.width - PET_SIZE, Math.max(area.x, position.x))),
    y: Math.round(Math.min(area.y + area.height - PET_SIZE, Math.max(area.y, position.y))),
  };
}

function createPetWindow() {
  const position = clampPosition(state.settings.petPosition ?? defaultPetPosition());
  const effectiveAlwaysOnTop = state.settings.alwaysOnTop || state.settings.desktopLocked;
  petWindow = new BrowserWindow({
    width: PET_SIZE, height: PET_SIZE, x: position.x, y: position.y,
    transparent: true, frame: false, resizable: false, hasShadow: false,
    alwaysOnTop: effectiveAlwaysOnTop, skipTaskbar: true, show: false,
    backgroundColor: '#00000000', webPreferences: windowOptions(),
  });
  petWindow.setAlwaysOnTop(effectiveAlwaysOnTop, 'floating');
  if (state.settings.desktopLocked) {
    petWindow.setFocusable(false);
    petWindow.setIgnoreMouseEvents(true);
  }
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  void loadView(petWindow, 'pet').then(() => petWindow?.showInactive());
  petWindow.on('close', (event) => {
    if (!quitting) { event.preventDefault(); petWindow?.hide(); }
  });
}

const unlockDocument = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}body{display:grid;place-items:center}button{width:36px;height:36px;border:1px solid rgba(255,255,255,.9);border-radius:50%;background:linear-gradient(145deg,#ffad46,#ee7620);color:white;font-size:18px;line-height:1;cursor:pointer;box-shadow:0 4px 12px rgba(95,45,12,.28)}button:hover{filter:brightness(1.08)}button:active{transform:scale(.94)}button:focus-visible{outline:2px solid white;outline-offset:-4px}</style></head><body><button id="unlock-pet" type="button" title="点击解锁小橙子" aria-label="解锁小橙子">🔓</button></body></html>`;

function positionUnlockWindow() {
  if (!petWindow || !unlockWindow || unlockWindow.isDestroyed()) return;
  const petBounds = petWindow.getBounds();
  const area = screen.getDisplayMatching(petBounds).workArea;
  const x = Math.round(Math.min(area.x + area.width - UNLOCK_SIZE, Math.max(area.x, petBounds.x + PET_SIZE - UNLOCK_SIZE - 8)));
  const y = Math.round(Math.min(area.y + area.height - UNLOCK_SIZE, Math.max(area.y, petBounds.y + 8)));
  unlockWindow.setPosition(x, y);
}

function createUnlockWindow(): BrowserWindow {
  if (unlockWindow && !unlockWindow.isDestroyed()) return unlockWindow;
  unlockWindow = new BrowserWindow({
    width: UNLOCK_SIZE, height: UNLOCK_SIZE, show: false, resizable: false,
    maximizable: false, minimizable: false, transparent: true, frame: false,
    hasShadow: false, alwaysOnTop: true, skipTaskbar: true, focusable: false,
    backgroundColor: '#00000000', webPreferences: {
      preload: unlockPreloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  unlockWindow.setAlwaysOnTop(true, 'floating');
  unlockWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  positionUnlockWindow();
  void unlockWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(unlockDocument)}`).then(() => {
    if (state.settings.desktopLocked) unlockWindow?.showInactive();
  });
  unlockWindow.on('close', (event) => {
    if (!quitting && state.settings.desktopLocked) { event.preventDefault(); unlockWindow?.hide(); }
  });
  return unlockWindow;
}

function createPanelWindow() {
  panelWindow = new BrowserWindow({
    width: PANEL_WIDTH, height: PANEL_HEIGHT, show: false, resizable: false,
    maximizable: false, minimizable: true, title: '小橙子管理面板',
    backgroundColor: '#fff8ec', webPreferences: windowOptions(),
  });
  void loadView(panelWindow, 'panel');
  panelWindow.on('close', (event) => {
    if (!quitting) { event.preventDefault(); panelWindow?.hide(); }
  });
  panelWindow.on('focus', () => cancelPetMotion());
}

function positionPanel() {
  if (!petWindow || !panelWindow) return;
  const petBounds = petWindow.getBounds();
  const area = screen.getDisplayMatching(petBounds).workArea;
  let x = petBounds.x - PANEL_WIDTH - 12;
  if (x < area.x) x = petBounds.x + PET_SIZE + 12;
  x = Math.min(area.x + area.width - PANEL_WIDTH, Math.max(area.x, x));
  const y = Math.min(area.y + area.height - PANEL_HEIGHT, Math.max(area.y, petBounds.y + PET_SIZE - PANEL_HEIGHT));
  panelWindow.setPosition(Math.round(x), Math.round(y));
}

function togglePanel(force?: boolean) {
  if (!panelWindow) return;
  if (state.settings.desktopLocked) {
    panelWindow.hide();
    return;
  }
  const shouldShow = force ?? !panelWindow.isVisible();
  if (shouldShow) { positionPanel(); panelWindow.show(); panelWindow.focus(); }
  else panelWindow.hide();
}

function broadcast() {
  for (const window of [petWindow, panelWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send('state:changed', state);
  }
}

function broadcastRuntime(runtime: PetRuntimeState) {
  for (const window of [petWindow, panelWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send('interaction:runtime-changed', runtime);
  }
}

function growthProgress(source: GrowthProgressEvent['source'], fromLevel: number): GrowthProgressEvent | null {
  if (state.growth.level <= fromLevel) return null;
  return {
    source,
    fromLevel,
    toLevel: state.growth.level,
    milestones: deriveGrowthMilestones(fromLevel, state.growth.level),
  };
}

function broadcastGrowthProgress(progress: GrowthProgressEvent | null) {
  if (!progress) return;
  for (const window of [petWindow, panelWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send('growth:progress', progress);
  }
}

function createInteractionController() {
  interactionController = new InteractionController({
    getContext: () => ({
      bounds: petWindow?.getBounds() ?? { ...defaultPetPosition(), width: PET_SIZE, height: PET_SIZE },
      stage: state.growth.stage,
      locked: state.settings.desktopLocked,
      mouseEnabled: state.settings.mouseInteractionsEnabled,
      keyboardEnabled: state.settings.keyboardInteractionEnabled && state.settings.keyboardConsentVersion === KEYBOARD_CONSENT_VERSION,
      sleeping: state.pet.behavior === 'sleeping',
      careBusy: state.pet.behavior === 'eating' || state.pet.behavior === 'playing' || state.pet.behavior === 'cleaning',
      foregroundFullscreen,
    }),
    emit: broadcastRuntime,
    openPanel: () => togglePanel(true),
    movePet,
    finishPetMove: () => { if (state && store) store.save(state); },
  });
}

function saveAndBroadcast() {
  store.save(state);
  broadcast();
  rebuildTrayMenu();
  rebuildApplicationMenu();
}

function rebuildApplicationMenu() {
  if (!state) return;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: '文件', submenu: [
        { label: '打开管理面板', accelerator: 'CmdOrCtrl+O', enabled: !state.settings.desktopLocked, click: () => togglePanel(true) },
        { label: '隐藏管理面板', click: () => togglePanel(false) },
        { type: 'separator' },
        { label: '退出小橙子', accelerator: 'Alt+F4', click: () => { quitting = true; app.quit(); } },
      ],
    },
    {
      label: '宠物', submenu: [
        { label: '唤回小橙子', enabled: !state.settings.desktopLocked, click: () => { petWindow?.showInactive(); animatePetTo(defaultPetPosition()); } },
        { label: state.pet.behavior === 'sleeping' ? '叫醒小橙子' : '让小橙子睡觉', enabled: !state.settings.desktopLocked, click: () => { cancelPetMotion(); interactionController?.suspendForCare(); state = performAction(state, 'sleep').state; saveAndBroadcast(); } },
        { label: '自动散步', type: 'checkbox', checked: state.settings.autoWalk, enabled: !state.settings.desktopLocked, click: (item) => updateSetting('autoWalk', item.checked) },
        { type: 'separator' },
        { label: state.settings.desktopLocked ? '解锁小橙子' : '锁定在桌面', click: () => setDesktopLocked(!state.settings.desktopLocked) },
      ],
    },
    {
      label: '查看', submenu: [
        { label: '重新加载面板', role: 'reload' },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { label: '恢复默认缩放', role: 'resetZoom' },
      ],
    },
    {
      label: '帮助', submenu: [
        { label: `小橙子桌宠 ${app.getVersion()}`, enabled: false },
        { label: '数据仅保存在本机', enabled: false },
      ],
    },
  ]));
}

function createTrayImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="17" r="12" fill="#ff8a1f"/><ellipse cx="17" cy="4" rx="6" ry="3" fill="#4d9b4b"/><circle cx="12" cy="15" r="1.5"/><circle cx="20" cy="15" r="1.5"/><path d="M12 20 Q16 23 20 20" fill="none" stroke="#562b1a" stroke-width="1.5"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`).resize({ width: 16, height: 16 });
}

function createTray() {
  tray = new Tray(createTrayImage());
  tray.setToolTip('小橙子桌宠');
  tray.on('click', () => {
    petWindow?.showInactive();
    if (state.settings.desktopLocked) { positionUnlockWindow(); unlockWindow?.showInactive(); }
    else togglePanel(true);
  });
  rebuildTrayMenu();
}

function rebuildTrayMenu() {
  if (!tray || !state) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '唤回小橙子', enabled: !state.settings.desktopLocked, click: () => { petWindow?.showInactive(); animatePetTo(defaultPetPosition()); } },
    { label: '打开管理面板', enabled: !state.settings.desktopLocked, click: () => togglePanel(true) },
    { type: 'separator' },
    { label: '自动散步', type: 'checkbox', checked: state.settings.autoWalk, enabled: !state.settings.desktopLocked, click: (item) => updateSetting('autoWalk', item.checked) },
    { label: '始终置顶', type: 'checkbox', checked: state.settings.alwaysOnTop || state.settings.desktopLocked, enabled: !state.settings.desktopLocked, click: (item) => updateSetting('alwaysOnTop', item.checked) },
    { label: state.settings.desktopLocked ? '解锁小橙子' : '锁定在桌面', click: () => setDesktopLocked(!state.settings.desktopLocked) },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } },
  ]));
}

function movePet(position: PetPosition) {
  if (!petWindow) return;
  const safe = clampPosition(position);
  petWindow.setPosition(safe.x, safe.y);
  state.settings.petPosition = safe;
  if (state.settings.desktopLocked) positionUnlockWindow();
}

function setDesktopLocked(locked: boolean, persist = true): SaveData {
  if (locked) {
    try { createUnlockWindow(); }
    catch {
      if (!persist) state.settings.desktopLocked = false;
      throw new Error('无法创建解锁按钮，未进入锁定模式');
    }
    cancelPetMotion();
    if (petWindow) movePet(petWindow.getBounds());
    interactionController?.cancelForLock();
    panelWindow?.hide();
    state.settings.desktopLocked = true;
    petWindow?.setAlwaysOnTop(true, 'floating');
    petWindow?.setFocusable(false);
    petWindow?.setIgnoreMouseEvents(true);
    positionUnlockWindow();
    unlockWindow?.showInactive();
  } else {
    state.settings.desktopLocked = false;
    interactionController?.cancelForLock();
    petWindow?.setIgnoreMouseEvents(false);
    petWindow?.setFocusable(true);
    petWindow?.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating');
    unlockWindow?.hide();
  }
  if (persist) saveAndBroadcast();
  else {
    rebuildTrayMenu();
    rebuildApplicationMenu();
  }
  return state;
}

function broadcastMotion(moving: boolean) {
  if (motionMoving === moving) {
    interactionController?.setMotion({ moving, direction: motionDirection });
    return;
  }
  motionMoving = moving;
  interactionController?.setMotion({ moving, direction: motionDirection });
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send('motion:changed', { moving, direction: motionDirection });
}

function cancelPetMotion(resetBehavior = true) {
  motionToken += 1;
  if (motionTimer) clearTimeout(motionTimer);
  motionTimer = null;
  if (resetBehavior && state?.pet.behavior === 'walking') {
    state.pet.behavior = motionRestoreBehavior;
    broadcast();
  }
  broadcastMotion(false);
}

function animatePetTo(position: PetPosition) {
  if (!petWindow || state.settings.desktopLocked) return;
  cancelPetMotion();
  const from = petWindow.getBounds();
  const target = clampPosition(position);
  if (from.x === target.x && from.y === target.y) {
    movePet(target);
    store.save(state);
    return;
  }

  const previousBehavior = state.pet.behavior === 'walking' ? 'idle' : state.pet.behavior;
  motionRestoreBehavior = previousBehavior;
  const plan = createMotionPlan({ x: from.x, y: from.y }, target, state.settings.animationIntensity);
  const token = ++motionToken;
  const startedAt = Date.now();
  motionDirection = plan.direction;
  state.pet.behavior = 'walking';
  broadcastMotion(true);
  broadcast();

  const tick = () => {
    if (!petWindow || token !== motionToken) return;
    const progress = Math.min(1, (Date.now() - startedAt) / plan.durationMs);
    const next = positionAt(plan, progress);
    petWindow.setPosition(next.x, next.y);
    if (progress < 1) {
      motionTimer = setTimeout(tick, 33);
      return;
    }
    motionTimer = null;
    state.settings.petPosition = target;
    if (state.pet.behavior === 'walking') state.pet.behavior = motionRestoreBehavior;
    broadcastMotion(false);
    broadcast();
    store.save(state);
  };
  tick();
}

function updateSetting(key: SettingKey, value: boolean | string): SaveData {
  if (key === 'petName') {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 12) throw new Error('名称需为 1–12 个字符');
    state.pet.name = value.trim();
  } else if (key === 'animationIntensity') {
    if (typeof value !== 'string' || !VALID_INTENSITIES.has(value as AnimationIntensity)) throw new Error('无效动画强度');
    state.settings.animationIntensity = value as AnimationIntensity;
  } else {
    if (typeof value !== 'boolean') throw new Error('设置值必须为布尔值');
    state.settings[key] = value;
    if (key === 'alwaysOnTop') petWindow?.setAlwaysOnTop(value || state.settings.desktopLocked, 'floating');
    if (key === 'launchAtLogin') app.setLoginItemSettings({ openAtLogin: value, path: process.execPath });
    if (key === 'autoWalk' && !value) cancelPetMotion();
  }
  saveAndBroadcast();
  return state;
}

function resetTemporaryBehavior() {
  if (actionResetTimer) clearTimeout(actionResetTimer);
  if (state.pet.behavior === 'sleeping') return;
  actionResetTimer = setTimeout(() => {
    if (state.pet.behavior !== 'sleeping') {
      state.pet.behavior = 'idle';
      saveAndBroadcast();
    }
  }, 2600);
}

function clearKeyboardReadyTimer() {
  if (keyboardReadyTimer) clearTimeout(keyboardReadyTimer);
  keyboardReadyTimer = null;
}

function stopKeyboardWorker(status: 'disabled' | 'unavailable' = 'disabled') {
  clearKeyboardReadyTimer();
  const worker = keyboardWorker;
  keyboardWorker = null;
  if (worker) {
    try { worker.postMessage({ type: 'stop' }); } catch { /* the isolated worker already stopped */ }
    setTimeout(() => { try { worker.kill(); } catch { /* already exited */ } }, 100);
  }
  interactionController?.setKeyboardStatus(status);
}

function failKeyboardWorker(worker: UtilityProcess) {
  if (keyboardWorker !== worker) return;
  stopKeyboardWorker('unavailable');
}

function startKeyboardWorker() {
  if (keyboardWorker) return;
  if (process.platform !== 'win32') {
    interactionController?.setKeyboardStatus('unavailable');
    return;
  }
  interactionController?.setKeyboardStatus('starting');
  try {
    const worker = utilityProcess.fork(keyboardWorkerPath, [], { stdio: 'ignore', serviceName: '小橙子键盘节奏' });
    keyboardWorker = worker;
    keyboardReadyTimer = setTimeout(() => failKeyboardWorker(worker), 2_000);
    worker.on('message', (message: unknown) => {
      if (keyboardWorker !== worker || !message || typeof message !== 'object') return;
      const payload = message as { type?: unknown; count?: unknown; endedAt?: unknown };
      if (payload.type === 'ready') {
        clearKeyboardReadyTimer();
        interactionController?.setKeyboardStatus('ready');
      } else if (payload.type === 'key-bucket'
        && Number.isInteger(payload.count) && (payload.count as number) > 0 && (payload.count as number) <= 250
        && typeof payload.endedAt === 'number' && Number.isFinite(payload.endedAt)) {
        interactionController?.recordKeyboardBucket(payload.count as number, payload.endedAt as number);
      }
    });
    worker.on('error', () => failKeyboardWorker(worker));
    worker.on('exit', () => failKeyboardWorker(worker));
  } catch {
    keyboardWorker = null;
    clearKeyboardReadyTimer();
    interactionController?.setKeyboardStatus('unavailable');
  }
}

function syncKeyboardWorker() {
  if (systemSuspended || screenLocked || !state.settings.keyboardInteractionEnabled || state.settings.keyboardConsentVersion !== KEYBOARD_CONSENT_VERSION) {
    stopKeyboardWorker('disabled');
    return;
  }
  startKeyboardWorker();
}

function advanceActualEconomyRuntime(now: number): boolean {
  if (runtimeBaselineAt === null) {
    runtimeBaselineAt = now;
    return false;
  }
  const elapsedRuntimeMs = now - runtimeBaselineAt;
  runtimeBaselineAt = now;
  if (elapsedRuntimeMs <= 0) return false;
  const result = advanceEconomyRuntime(state.economy, elapsedRuntimeMs, now);
  state = { ...state, economy: result.economy };
  return result.completedExpedition;
}

function pauseNativeInput() {
  stopKeyboardWorker('disabled');
  interactionController?.tick(null, Date.now());
}

function pauseActualRuntimeForSuspend() {
  let progress: GrowthProgressEvent | null = null;
  if (runtimeBaselineAt !== null) {
    const now = Date.now();
    const fromLevel = state.growth.level;
    state = advanceOnline(state, now);
    progress = growthProgress('online', fromLevel);
    advanceActualEconomyRuntime(now);
  }
  runtimeBaselineAt = null;
  pauseNativeInput();
  if (state && store) {
    saveAndBroadcast();
    broadcastGrowthProgress(progress);
  }
}

function resumeActualRuntimeAfterSuspend() {
  state = settleOffline(state, Date.now()).state;
  saveAndBroadcast();
  if (!systemSuspended) {
    runtimeBaselineAt = Date.now();
    syncKeyboardWorker();
  }
}

function assertPanelRequest(event: Electron.IpcMainInvokeEvent): void {
  if (!panelWindow || event.sender !== panelWindow.webContents) throw new Error('无效面板请求');
  if (state.settings.desktopLocked) throw new Error('小橙子已锁定，请先解锁');
}

function commitEconomyResult(result: {
  economy: SaveData['economy'];
  ok: boolean;
  code: EconomyActionCode;
  message: string;
}): EconomyIpcResult {
  if (result.ok) {
    state = { ...state, economy: result.economy };
    saveAndBroadcast();
  }
  return { state, ok: result.ok, code: result.code, message: result.message };
}

function inventoryStatFailureCode(code: ReturnType<typeof applyInventoryStatEffect>['code']): EconomyActionCode {
  if (code === 'invalid-item' || code === 'invalid-stats' || code === 'stats-full' || code === 'insufficient-stat') return code;
  return 'invalid-stats';
}

function setupIpc() {
  ipcMain.handle('state:bootstrap', () => ({
    state,
    runtime: interactionController?.snapshot(),
    offlineSummary: startupOfflineSummary,
    growthProgress: null,
  }));
  ipcMain.handle('state:load', () => state);
  ipcMain.handle('interaction:runtime-load', () => interactionController?.snapshot());
  ipcMain.handle('pet:action', (event, action: unknown) => {
    assertPanelRequest(event);
    if (typeof action !== 'string' || !VALID_ACTIONS.has(action as PetAction)) throw new Error('无效互动');
    cancelPetMotion();
    interactionController?.suspendForCare();
    const fromLevel = state.growth.level;
    const result = performAction(state, action as PetAction);
    state = result.state;
    saveAndBroadcast();
    broadcastGrowthProgress(growthProgress('care', fromLevel));
    resetTemporaryBehavior();
    return { state, message: result.message };
  });
  ipcMain.handle('settings:set', (event, key: unknown, value: unknown) => {
    assertPanelRequest(event);
    const validKeys: SettingKey[] = ['autoWalk', 'alwaysOnTop', 'launchAtLogin', 'animationIntensity', 'petName'];
    if (typeof key !== 'string' || !validKeys.includes(key as SettingKey)) throw new Error('无效设置项');
    if (typeof value !== 'boolean' && typeof value !== 'string') throw new Error('无效设置值');
    return updateSetting(key as SettingKey, value);
  });
  ipcMain.handle('panel:toggle', (event) => {
    if ((!petWindow || event.sender !== petWindow.webContents) && (!panelWindow || event.sender !== panelWindow.webContents)) throw new Error('无效面板请求');
    togglePanel();
  });
  ipcMain.handle('pet:context-menu', (event) => {
    if (!petWindow || event.sender !== petWindow.webContents || state.settings.desktopLocked) throw new Error('当前无法打开菜单');
    const menu = Menu.buildFromTemplate([
      { label: `打开${state.pet.name}面板`, click: () => togglePanel(true) },
      { label: state.pet.behavior === 'sleeping' ? '叫醒' : '睡觉', click: () => { cancelPetMotion(); interactionController?.suspendForCare(); state = performAction(state, 'sleep').state; saveAndBroadcast(); } },
      { label: '自动散步', type: 'checkbox', checked: state.settings.autoWalk, click: (item) => updateSetting('autoWalk', item.checked) },
      { label: '锁定在桌面', click: () => setDesktopLocked(true) },
      { type: 'separator' },
      { label: '隐藏', click: () => petWindow?.hide() },
      { label: '退出', click: () => { quitting = true; app.quit(); } },
    ]);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) ?? undefined });
  });
  ipcMain.handle('pet:tap', (event) => {
    if (!petWindow || event.sender !== petWindow.webContents) throw new Error('无效互动来源');
    interactionController?.recordTap();
  });
  ipcMain.handle('pet:drag-start', (event) => {
    if (!petWindow || event.sender !== petWindow.webContents || state.settings.desktopLocked) return false;
    cancelPetMotion();
    return interactionController?.beginDrag() ?? false;
  });
  ipcMain.handle('pet:set-position', (event, position: unknown) => {
    if (!petWindow || event.sender !== petWindow.webContents || state.settings.desktopLocked || !interactionController?.isDragging()) throw new Error('当前无法拖动小橙子');
    if (!position || typeof position !== 'object') throw new Error('无效位置');
    const { x, y } = position as PetPosition;
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('无效坐标');
    cancelPetMotion();
    movePet({ x, y });
    return state.settings.petPosition;
  });
  ipcMain.handle('pet:drag-end', (event) => {
    if (!petWindow || event.sender !== petWindow.webContents) throw new Error('无效互动来源');
    interactionController?.endDrag();
  });
  ipcMain.handle('desktop-lock:set', (event, locked: unknown) => {
    assertPanelRequest(event);
    if (typeof locked !== 'boolean') throw new Error('无效锁定请求');
    return setDesktopLocked(locked);
  });
  ipcMain.handle('desktop-lock:unlock', (event) => {
    if (!unlockWindow || event.sender !== unlockWindow.webContents) throw new Error('无效解锁请求');
    setDesktopLocked(false);
  });
  ipcMain.handle('mouse-interaction:set', (event, enabled: unknown) => {
    assertPanelRequest(event);
    if (typeof enabled !== 'boolean') throw new Error('无效鼠标互动设置');
    state.settings.mouseInteractionsEnabled = enabled;
    saveAndBroadcast();
    return state;
  });
  ipcMain.handle('keyboard-interaction:set', (event, enabled: unknown, consentVersion: unknown) => {
    assertPanelRequest(event);
    if (typeof enabled !== 'boolean') throw new Error('无效键盘互动设置');
    if (enabled && state.settings.keyboardConsentVersion !== KEYBOARD_CONSENT_VERSION) {
      if (consentVersion !== KEYBOARD_CONSENT_VERSION) throw new Error('开启前需要确认键盘节奏说明');
      state.settings.keyboardConsentVersion = KEYBOARD_CONSENT_VERSION;
    }
    state.settings.keyboardInteractionEnabled = enabled;
    saveAndBroadcast();
    syncKeyboardWorker();
    return state;
  });
  ipcMain.handle('economy:item-purchase', (event, itemId: unknown, quantity: unknown) => {
    assertPanelRequest(event);
    if (!isInventoryItemId(itemId)) throw new Error('无效用品');
    if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_PURCHASE_QUANTITY) throw new Error('无效购买数量');
    return commitEconomyResult(purchaseInventoryItem(state.economy, itemId, quantity as number));
  });
  ipcMain.handle('economy:item-use', (event, itemId: unknown): EconomyIpcResult => {
    assertPanelRequest(event);
    if (!isInventoryItemId(itemId)) throw new Error('无效用品');
    const statResult = applyInventoryStatEffect(state.pet.stats, statCap(state.growth.level), itemId);
    if (!statResult.ok) {
      return { state, ok: false, code: inventoryStatFailureCode(statResult.code), message: statResult.message };
    }
    const economyResult = useInventoryItem(state.economy, itemId);
    if (!economyResult.ok) return commitEconomyResult(economyResult);
    state = {
      ...state,
      pet: { ...state.pet, stats: statResult.stats },
      economy: economyResult.economy,
    };
    saveAndBroadcast();
    const message = statResult.code === 'no-stat-effect'
      ? economyResult.message
      : `${economyResult.message}${statResult.message}`;
    return { state, ok: true, code: economyResult.code, message };
  });
  ipcMain.handle('expedition:start', (event, expeditionId: unknown) => {
    assertPanelRequest(event);
    if (!isExpeditionId(expeditionId)) throw new Error('无效探索委托');
    return commitEconomyResult(startExpedition(state.economy, expeditionId, Date.now()));
  });
  ipcMain.handle('expedition:return', (event) => {
    assertPanelRequest(event);
    return commitEconomyResult(returnExpeditionEarly(state.economy));
  });
  ipcMain.handle('expedition:ack', (event) => {
    assertPanelRequest(event);
    return commitEconomyResult(acknowledgeExpeditionReward(state.economy));
  });
  ipcMain.handle('shop:buy', (event, itemId: unknown) => {
    assertPanelRequest(event);
    if (typeof itemId !== 'string' || !findShopItem(itemId)) throw new Error('无效装扮');
    const result = buyItem(state, itemId);
    state = result.state;
    saveAndBroadcast();
    return { ok: result.ok, message: result.message, state };
  });
  ipcMain.handle('shop:equip', (event, itemId: unknown) => {
    assertPanelRequest(event);
    if (itemId !== null && (typeof itemId !== 'string' || !findShopItem(itemId) || !state.economy.ownedItems.includes(itemId))) throw new Error('尚未拥有该装扮');
    state.economy.equippedItem = itemId as string | null;
    saveAndBroadcast();
    return state;
  });
  ipcMain.handle('app:quit', () => { quitting = true; app.quit(); });
}

async function detectForegroundFullscreen() {
  if (process.platform !== 'win32') return false;
  const command = `$s='[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out R r);public struct R{public int L;public int T;public int Rg;public int B;}';Add-Type -MemberDefinition $s -Name W -Namespace N -ErrorAction SilentlyContinue;$h=[N.W]::GetForegroundWindow();$r=New-Object N.W+R;[N.W]::GetWindowRect($h,[ref]$r)|Out-Null;Write-Output \"$($r.L),$($r.T),$($r.Rg),$($r.B)\"`;
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, timeout: 2500 });
    const [left, top, right, bottom] = stdout.trim().split(',').map(Number);
    if (![left, top, right, bottom].every(Number.isFinite)) return false;
    return screen.getAllDisplays().some(({ bounds }) => Math.abs(left - bounds.x) <= 2 && Math.abs(top - bounds.y) <= 2 && Math.abs(right - bounds.x - bounds.width) <= 2 && Math.abs(bottom - bounds.y - bounds.height) <= 2);
  } catch { return false; }
}

function startTimers() {
  runtimeBaselineAt = Date.now();
  setInterval(() => {
    if (systemSuspended) return;
    const fromLevel = state.growth.level;
    state = advanceOnline(state, Date.now());
    saveAndBroadcast();
    broadcastGrowthProgress(growthProgress('online', fromLevel));
  }, 60_000);
  setInterval(() => {
    const now = Date.now();
    if (systemSuspended) {
      runtimeBaselineAt = null;
      return;
    }
    if (advanceActualEconomyRuntime(now)) saveAndBroadcast();
    else broadcast();
  }, 5_000);
  setInterval(async () => {
    foregroundFullscreen = await detectForegroundFullscreen();
    if (foregroundFullscreen) cancelPetMotion();
  }, 5_000);
  setInterval(() => {
    const maySampleCursor = !systemSuspended
      && !screenLocked
      && state.settings.mouseInteractionsEnabled
      && state.pet.behavior !== 'sleeping'
      && state.pet.behavior !== 'eating'
      && state.pet.behavior !== 'playing'
      && state.pet.behavior !== 'cleaning'
      && !foregroundFullscreen
      && Boolean(petWindow?.isVisible());
    const cursor = maySampleCursor ? screen.getCursorScreenPoint() : null;
    interactionController?.tick(cursor, Date.now());
  }, 50);
  const scheduleWalk = () => setTimeout(() => {
    if (!petWindow || systemSuspended || screenLocked || state.settings.desktopLocked || !state.settings.autoWalk || state.pet.behavior !== 'idle' || foregroundFullscreen || panelWindow?.isFocused()) {
      scheduleWalk();
      return;
    }
    const bounds = petWindow.getBounds();
    const area = screen.getDisplayMatching(bounds).workArea;
    const maxStep = state.settings.animationIntensity === 'gentle' ? 40 : state.settings.animationIntensity === 'lively' ? 110 : 75;
    const delta = Math.round((Math.random() - 0.5) * maxStep * 2);
    animatePetTo({ x: bounds.x + delta, y: area.y + area.height - PET_SIZE - 8 });
    scheduleWalk();
  }, 8_000 + Math.round(Math.random() * 8_000));
  scheduleWalk();
}

app.whenReady().then(() => {
  store = new SaveStore(app.getPath('userData'));
  try {
    const loaded = store.loadWithSummary();
    state = loaded.state;
    startupOfflineSummary = loaded.offlineSummary;
  } catch (error) {
    const detail = error instanceof Error ? error.message : '存档无法安全读取。';
    dialog.showErrorBox('小橙子无法安全读取存档', `${detail}\n\n原存档和备份均已保留，应用将安全退出，不会创建新档覆盖。`);
    quitting = true;
    app.quit();
    return;
  }
  createInteractionController();
  setupIpc();
  createPetWindow();
  createPanelWindow();
  createTray();
  if (state.settings.desktopLocked) {
    try { setDesktopLocked(true, false); }
    catch {
      state.settings.desktopLocked = false;
      petWindow?.setIgnoreMouseEvents(false);
      petWindow?.setFocusable(true);
      petWindow?.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating');
      store.save(state);
    }
  }
  syncKeyboardWorker();
  rebuildApplicationMenu();
  startTimers();
  powerMonitor.on('suspend', () => {
    systemSuspended = true;
    pauseActualRuntimeForSuspend();
  });
  powerMonitor.on('lock-screen', () => {
    screenLocked = true;
    pauseNativeInput();
  });
  powerMonitor.on('resume', () => {
    systemSuspended = false;
    resumeActualRuntimeAfterSuspend();
  });
  powerMonitor.on('unlock-screen', () => {
    if (!screenLocked) return;
    screenLocked = false;
    syncKeyboardWorker();
  });
  const recoverPetPosition = () => {
    if (state.settings.desktopLocked) {
      movePet(state.settings.petPosition ?? defaultPetPosition());
      positionUnlockWindow();
      store.save(state);
    } else animatePetTo(state.settings.petPosition ?? defaultPetPosition());
  };
  screen.on('display-removed', recoverPetPosition);
  screen.on('display-metrics-changed', recoverPetPosition);
});

app.on('window-all-closed', () => { /* keep the tray application alive */ });
app.on('before-quit', () => {
  quitting = true;
  stopKeyboardWorker('disabled');
  if (state && store) {
    if (runtimeBaselineAt !== null) {
      const now = Date.now();
      state = advanceOnline(state, now);
      advanceActualEconomyRuntime(now);
      runtimeBaselineAt = null;
    }
    store.save(state);
  }
});

if (!app.requestSingleInstanceLock()) app.quit();
else app.on('second-instance', () => {
  petWindow?.showInactive();
  if (state?.settings.desktopLocked) { positionUnlockWindow(); unlockWindow?.showInactive(); }
  else togglePanel(true);
});
