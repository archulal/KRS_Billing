const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron,
  printToPrinter: (options) => ipcRenderer.invoke('print-to-printer', options),
});
