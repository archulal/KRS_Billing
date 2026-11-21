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
  listPrinters: () => ipcRenderer.invoke('list-printers'),

  // Generate a PDF of the currently visible invoice for WhatsApp sharing
  generateBillPdf: (options) => ipcRenderer.invoke('generate-bill-pdf', options),

  // Generate a PDF of the currently visible customer ledger statement
  generateLedgerPdf: (options) => ipcRenderer.invoke('generate-ledger-pdf', options),

  // WhatsApp Web automation (main process owns the client/session)
  whatsapp: {
    getStatus: () => ipcRenderer.invoke('whatsapp:get-status'),
    connect: () => ipcRenderer.invoke('whatsapp:connect'),
    disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),
    sendBill: (payload) => ipcRenderer.invoke('whatsapp:send-bill', payload),
    sendText: (payload) => ipcRenderer.invoke('whatsapp:send-text', payload),
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on('whatsapp:status', listener);
      return () => ipcRenderer.removeListener('whatsapp:status', listener);
    }
  }
});
