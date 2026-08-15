import { contextBridge, ipcRenderer } from 'electron';
import type { OrangePetApi, PetAction, PetMotionState, PetPosition, SaveData, SettingKey } from '../shared/types';

const api: OrangePetApi = {
  loadState: () => ipcRenderer.invoke('state:load'),
  performAction: (action: PetAction) => ipcRenderer.invoke('pet:action', action),
  setSetting: (key: SettingKey, value: boolean | string) => ipcRenderer.invoke('settings:set', key, value),
  togglePanel: () => ipcRenderer.invoke('panel:toggle'),
  showContextMenu: () => ipcRenderer.invoke('pet:context-menu'),
  setPetPosition: (position: PetPosition) => ipcRenderer.invoke('pet:set-position', position),
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
};

contextBridge.exposeInMainWorld('orangePet', api);
