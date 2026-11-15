const { contextBridge, ipcRenderer } = require('electron');
// Narrow validated update/course capabilities; no generic IPC or filesystem access.
contextBridge.exposeInMainWorld('eguitarDesktop', Object.freeze({
  platform: process.platform, updatesSupported: process.platform === 'win32' || process.platform === 'darwin',
  checkUpdates: () => ipcRenderer.invoke('eguitar:check-updates'),
  openGuitarPro: bytes => ipcRenderer.invoke('eguitar:open-guitar-pro', bytes),
  openCourse: url => ipcRenderer.invoke('eguitar:open-course', url),
}));
