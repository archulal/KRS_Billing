const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let expressServer = null;
const BACKEND_PORT = process.env.PORT || 4567;

// Function to start local backend server
async function startBackend() {
  try {
    const { startServer } = require('../server/index.js');
    const result = await startServer(BACKEND_PORT);
    expressServer = result.server;
    console.log('[Electron] Embedded Express backend running on port:', BACKEND_PORT);
  } catch (err) {
    console.error('[Electron] Failed to start embedded backend server:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: 'KRS Banana Wholesale Billing | കെ.ആർ.എസ് വാഴപ്പഴ മൊത്തവ്യാപാരം',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
    backgroundColor: '#f1f5f9',
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;

  if (devUrl) {
    console.log('[Electron] Loading Vite Dev Server URL:', devUrl);
    mainWindow.loadURL(devUrl);
  } else {
    console.log(`[Electron] Loading embedded backend on http://127.0.0.1:${BACKEND_PORT}`);
    mainWindow.webContents.on('did-fail-load', (event, errorCode) => {
      console.log('[Electron] Load failed with code:', errorCode, '- Retrying in 500ms...');
      setTimeout(() => {
        if (mainWindow) mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`);
      }, 500);
    });
    mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers for printing
ipcMain.handle('print-to-printer', async (event, options) => {
  if (!mainWindow) return false;
  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: options?.silent || false,
        printBackground: true,
        pageSize: options?.pageSize || 'A5',
        margins: {
          marginType: 'custom',
          top: 0.2,
          bottom: 0.2,
          left: 0.2,
          right: 0.2,
        },
      },
      (success, failureReason) => {
        if (!success) console.log('Print failed:', failureReason);
        resolve({ success, failureReason });
      }
    );
  });
});

app.whenReady().then(async () => {
  // Set SQLite DB storage directory to official OS userData path
  const userDataPath = app.getPath('userData');
  process.env.KRS_DATA_DIR = path.join(userDataPath, 'database');
  console.log('[Electron] App ready, userData path:', userDataPath);

  await startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (expressServer) {
    expressServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
