// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron,

  // Fallback explicit‑printer call (still available if needed)
  printToPrinter: (options) => ipcRenderer.invoke('print-to-printer', options),

  // Silent printing (used by the component)
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),
  

  // Fetch list of printers (used to get the device name)
  listPrinters: () => ipcRenderer.invoke('list-printers')
});
