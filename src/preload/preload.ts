import { contextBridge, ipcRenderer } from 'electron';
import type { ExpeditionId, InventoryItemId } from '../shared/economy-types';
import type { GrowthProgressEvent, OrangePetApi, PetAction, PetMotionState, PetPosition, PetRuntimeState, SaveData, SettingKey } from '../shared/types';

const api: OrangePetApi = {
  loadBootstrap: () => ipcRenderer.invoke('state:bootstrap'),
  loadState: () => ipcRenderer.invoke('state:load'),
  loadRuntimeState: () => ipcRenderer.invoke('interaction:runtime-load'),
  performAction: (action, request) => ipcRenderer.invoke('pet:action', action, request),
  purchaseInventoryItem: (itemId: InventoryItemId, quantity: number) => ipcRenderer.invoke('economy:item-purchase', itemId, quantity),
  useInventoryItem: (itemId: InventoryItemId) => ipcRenderer.invoke('economy:item-use', itemId),
  startExpedition: (expeditionId: ExpeditionId) => ipcRenderer.invoke('expedition:start', expeditionId),
  returnExpeditionEarly: () => ipcRenderer.invoke('expedition:return'),
  acknowledgeExpeditionReward: () => ipcRenderer.invoke('expedition:ack'),
  setSetting: (key: SettingKey, value: boolean | string) => ipcRenderer.invoke('settings:set', key, value),
  togglePanel: () => ipcRenderer.invoke('panel:toggle'),
  showContextMenu: () => ipcRenderer.invoke('pet:context-menu'),
  setPetPosition: (position: PetPosition) => ipcRenderer.invoke('pet:set-position', position),
  recordPetTap: () => ipcRenderer.invoke('pet:tap'),
  beginPetDrag: () => ipcRenderer.invoke('pet:drag-start'),
  endPetDrag: () => ipcRenderer.invoke('pet:drag-end'),
  setDesktopLocked: (locked: boolean) => ipcRenderer.invoke('desktop-lock:set', locked),
  setMouseInteractions: (enabled: boolean) => ipcRenderer.invoke('mouse-interaction:set', enabled),
  setKeyboardInteraction: (enabled: boolean, consentVersion?: number) => ipcRenderer.invoke('keyboard-interaction:set', enabled, consentVersion),
  buyItem: (itemId: string) => ipcRenderer.invoke('shop:buy', itemId),
  equipItem: (itemId: string | null) => ipcRenderer.invoke('shop:equip', itemId),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  onStateChanged: (callback: (state: SaveData) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: SaveData) => callback(state);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  },
  onMotionChanged: (callback: (motion: PetMotionState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, motion: PetMotionState) => callback(motion);
    ipcRenderer.on('motion:changed', listener);
    return () => ipcRenderer.removeListener('motion:changed', listener);
  },
  onRuntimeChanged: (callback: (runtime: PetRuntimeState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, runtime: PetRuntimeState) => callback(runtime);
    ipcRenderer.on('interaction:runtime-changed', listener);
    return () => ipcRenderer.removeListener('interaction:runtime-changed', listener);
  },
  onGrowthProgress: (callback: (progress: GrowthProgressEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: GrowthProgressEvent) => callback(progress);
    ipcRenderer.on('growth:progress', listener);
    return () => ipcRenderer.removeListener('growth:progress', listener);
  },
};

contextBridge.exposeInMainWorld('orangePet', api);
