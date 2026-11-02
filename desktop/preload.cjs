const { contextBridge, ipcRenderer } = require('electron');
// One capability, no generic IPC, paths, URLs or process access.
contextBridge.exposeInMainWorld('eguitarDesktop', Object.freeze({
  checkUpdates: () => ipcRenderer.invoke('eguitar:check-updates'),
}));
