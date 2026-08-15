import { app, BrowserWindow, ipcMain, Menu, nativeImage, powerMonitor, screen, Tray } from 'electron';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { advanceOnline, buyItem, performAction } from '../shared/game';
import { findShopItem } from '../shared/catalog';
import type { AnimationIntensity, PetAction, PetBehavior, PetPosition, SaveData, SettingKey } from '../shared/types';
import { SaveStore } from './store';
import { createMotionPlan, positionAt } from './motion';

const execFileAsync = promisify(execFile);
const PET_SIZE = 220;
const PANEL_WIDTH = 390;
const PANEL_HEIGHT = 620;
const VALID_ACTIONS = new Set<PetAction>(['feed', 'play', 'clean', 'sleep']);
const VALID_INTENSITIES = new Set<AnimationIntensity>(['gentle', 'normal', 'lively']);

let petWindow: BrowserWindow | null = null;
let panelWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let store: SaveStore;
let state: SaveData;
let quitting = false;
let foregroundFullscreen = false;
let actionResetTimer: NodeJS.Timeout | null = null;
let motionTimer: NodeJS.Timeout | null = null;
let motionToken = 0;
let motionDirection: 'left' | 'right' = 'right';
let motionMoving = false;
let motionRestoreBehavior: PetBehavior = 'idle';

const preloadPath = path.join(__dirname, '..', 'preload', 'preload.js');
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
  petWindow = new BrowserWindow({
    width: PET_SIZE, height: PET_SIZE, x: position.x, y: position.y,
    transparent: true, frame: false, resizable: false, hasShadow: false,
    alwaysOnTop: state.settings.alwaysOnTop, skipTaskbar: true, show: false,
    backgroundColor: '#00000000', webPreferences: windowOptions(),
  });
  petWindow.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  void loadView(petWindow, 'pet').then(() => petWindow?.showInactive());
  petWindow.on('close', (event) => {
    if (!quitting) { event.preventDefault(); petWindow?.hide(); }
  });
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
  const shouldShow = force ?? !panelWindow.isVisible();
  if (shouldShow) { positionPanel(); panelWindow.show(); panelWindow.focus(); }
  else panelWindow.hide();
}

function broadcast() {
  for (const window of [petWindow, panelWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send('state:changed', state);
  }
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
        { label: '打开管理面板', accelerator: 'CmdOrCtrl+O', click: () => togglePanel(true) },
        { label: '隐藏管理面板', click: () => togglePanel(false) },
        { type: 'separator' },
        { label: '退出小橙子', accelerator: 'Alt+F4', click: () => { quitting = true; app.quit(); } },
      ],
    },
    {
      label: '宠物', submenu: [
        { label: '唤回小橙子', click: () => { petWindow?.showInactive(); animatePetTo(defaultPetPosition()); } },
        { label: state.pet.behavior === 'sleeping' ? '叫醒小橙子' : '让小橙子睡觉', click: () => { cancelPetMotion(); state = performAction(state, 'sleep').state; saveAndBroadcast(); } },
        { label: '自动散步', type: 'checkbox', checked: state.settings.autoWalk, click: (item) => updateSetting('autoWalk', item.checked) },
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
  tray.on('click', () => { petWindow?.showInactive(); togglePanel(true); });
  rebuildTrayMenu();
}

function rebuildTrayMenu() {
  if (!tray || !state) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '唤回小橙子', click: () => { petWindow?.showInactive(); animatePetTo(defaultPetPosition()); } },
    { label: '打开管理面板', click: () => togglePanel(true) },
    { type: 'separator' },
    { label: '自动散步', type: 'checkbox', checked: state.settings.autoWalk, click: (item) => updateSetting('autoWalk', item.checked) },
    { label: '始终置顶', type: 'checkbox', checked: state.settings.alwaysOnTop, click: (item) => updateSetting('alwaysOnTop', item.checked) },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } },
  ]));
}

function movePet(position: PetPosition) {
  if (!petWindow) return;
  const safe = clampPosition(position);
  petWindow.setPosition(safe.x, safe.y);
  state.settings.petPosition = safe;
}

function broadcastMotion(moving: boolean) {
  if (motionMoving === moving) return;
  motionMoving = moving;
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
  if (!petWindow) return;
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
    if (key === 'alwaysOnTop') petWindow?.setAlwaysOnTop(value, 'floating');
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

function setupIpc() {
  ipcMain.handle('state:load', () => state);
  ipcMain.handle('pet:action', (_event, action: unknown) => {
    if (typeof action !== 'string' || !VALID_ACTIONS.has(action as PetAction)) throw new Error('无效互动');
    cancelPetMotion();
    state = performAction(state, action as PetAction).state;
    saveAndBroadcast();
    resetTemporaryBehavior();
    return state;
  });
  ipcMain.handle('settings:set', (_event, key: unknown, value: unknown) => {
    const validKeys: SettingKey[] = ['autoWalk', 'alwaysOnTop', 'launchAtLogin', 'animationIntensity', 'petName'];
    if (typeof key !== 'string' || !validKeys.includes(key as SettingKey)) throw new Error('无效设置项');
    if (typeof value !== 'boolean' && typeof value !== 'string') throw new Error('无效设置值');
    return updateSetting(key as SettingKey, value);
  });
  ipcMain.handle('panel:toggle', () => togglePanel());
  ipcMain.handle('pet:context-menu', (event) => {
    const menu = Menu.buildFromTemplate([
      { label: `打开${state.pet.name}面板`, click: () => togglePanel(true) },
      { label: state.pet.behavior === 'sleeping' ? '叫醒' : '睡觉', click: () => { cancelPetMotion(); state = performAction(state, 'sleep').state; saveAndBroadcast(); } },
      { label: '自动散步', type: 'checkbox', checked: state.settings.autoWalk, click: (item) => updateSetting('autoWalk', item.checked) },
      { type: 'separator' },
      { label: '隐藏', click: () => petWindow?.hide() },
      { label: '退出', click: () => { quitting = true; app.quit(); } },
    ]);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) ?? undefined });
  });
  ipcMain.handle('pet:set-position', (_event, position: unknown) => {
    if (!position || typeof position !== 'object') throw new Error('无效位置');
    const { x, y } = position as PetPosition;
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('无效坐标');
    cancelPetMotion();
    movePet({ x, y });
    return state.settings.petPosition;
  });
  ipcMain.handle('shop:buy', (_event, itemId: unknown) => {
    if (typeof itemId !== 'string' || itemId.length > 40) throw new Error('无效装扮');
    const result = buyItem(state, itemId);
    state = result.state;
    saveAndBroadcast();
    return { ok: result.ok, message: result.message, state };
  });
  ipcMain.handle('shop:equip', (_event, itemId: unknown) => {
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
  setInterval(() => {
    state = advanceOnline(state, Date.now());
    saveAndBroadcast();
  }, 60_000);
  setInterval(async () => {
    foregroundFullscreen = await detectForegroundFullscreen();
    if (foregroundFullscreen) cancelPetMotion();
  }, 5_000);
  const scheduleWalk = () => setTimeout(() => {
    if (!petWindow || !state.settings.autoWalk || state.pet.behavior !== 'idle' || foregroundFullscreen || panelWindow?.isFocused()) {
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
  state = store.load();
  setupIpc();
  createPetWindow();
  createPanelWindow();
  createTray();
  rebuildApplicationMenu();
  startTimers();
  powerMonitor.on('resume', () => { state = advanceOnline(state, Date.now()); saveAndBroadcast(); });
  screen.on('display-removed', () => animatePetTo(state.settings.petPosition ?? defaultPetPosition()));
});

app.on('window-all-closed', () => { /* keep the tray application alive */ });
app.on('before-quit', () => { quitting = true; if (state && store) store.save(state); });

if (!app.requestSingleInstanceLock()) app.quit();
else app.on('second-instance', () => { petWindow?.showInactive(); togglePanel(true); });
