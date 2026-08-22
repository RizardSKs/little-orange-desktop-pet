import { contextBridge, ipcRenderer } from 'electron';
import type { OrangePetUnlockApi } from '../shared/types';

const unlock = () => ipcRenderer.invoke('desktop-lock:unlock');
const api: OrangePetUnlockApi = { unlock };

contextBridge.exposeInMainWorld('orangePetUnlock', api);

window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#unlock-pet')?.addEventListener('click', () => { void unlock(); });
});
