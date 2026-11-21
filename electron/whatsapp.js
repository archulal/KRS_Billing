// electron/whatsapp.js
// Manages the WhatsApp Web (whatsapp-web.js) client used to send bill PDFs.
// Runs in the Electron main process only.

const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { app } = require('electron');

let mainWindow = null;
let client = null;
let initializing = false;

let state = {
  status: 'idle', // idle | initializing | qr | authenticated | ready | auth_failure | disconnected | error
  qr: '', // data URL of the login QR code
  number: '', // number currently logged in on WhatsApp Web
  error: ''
};

// The DB must be loaded lazily: main.js sets KRS_DATA_DIR in app.whenReady(),
// and server/db.js reads that variable when it is first required.
function dbSettings() {
  return require('../server/db');
}

function sessionDir() {
  return path.join(app.getPath('userData'), 'whatsapp-session');
}

function setWindow(window) {
  mainWindow = window;
}

function emitStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('whatsapp:status', getStatus());
  }
}

function setStatus(patch) {
  state = { ...state, ...patch };
  emitStatus();
}

// Accepts 10-digit mobile numbers, +91 / 91 prefixes and strips formatting.
function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '').replace(/^00/, '');
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
  return /^91\d{10}$/.test(digits) ? digits : '';
}

function ownerInfo() {
  const configured = normalizePhone(dbSettings().getSetting('whatsapp_owner_number'));
  const connected = state.number || '';
  return {
    configured,
    connected,
    match: Boolean(configured && connected && configured === connected)
  };
}

function getStatus() {
  return { ...state, ...ownerInfo() };
}

// Use an installed Chrome/Chromium when available; otherwise fall back to the
// browser bundled with puppeteer by whatsapp-web.js.
function findChromeExecutable() {
  const candidates = [
    process.env.KRS_CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);

  return candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch (err) {
      return false;
    }
  }) || null;
}

function loadWhatsAppWeb() {
  return require('whatsapp-web.js');
}

async function connect() {
  if (client || initializing) return getStatus();

  initializing = true;
  setStatus({ status: 'initializing', error: '', qr: '', number: '' });

  try {
    const { Client, LocalAuth } = loadWhatsAppWeb();
    const sessionPath = sessionDir();

    const puppeteer = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      // Electron may set this variable when launched from npm; the Chromium
      // child process must not inherit it.
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '' }
    };

    const chromePath = findChromeExecutable();
    if (chromePath) puppeteer.executablePath = chromePath;

    client = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionPath }),
      puppeteer,
      qrMaxRetries: 3
    });

    client.on('qr', async (qr) => {
      try {
        const qrImage = await QRCode.toDataURL(qr, { width: 256, margin: 1 });
        setStatus({ status: 'qr', qr: qrImage, error: '' });
      } catch (err) {
        setStatus({ status: 'error', error: `QR code error: ${err.message}` });
      }
    });

    client.on('authenticated', () => {
      setStatus({ status: 'authenticated', error: '' });
    });

    client.on('ready', () => {
      setStatus({
        status: 'ready',
        number: client?.info?.wid?.user || '',
        qr: '',
        error: ''
      });
    });

    client.on('auth_failure', (message) => {
      setStatus({
        status: 'auth_failure',
        error: typeof message === 'string' ? message : 'WhatsApp authentication failed.',
        qr: ''
      });
    });

    client.on('disconnected', (reason) => {
      setStatus({
        status: 'disconnected',
        error: typeof reason === 'string' ? reason : 'WhatsApp disconnected.',
        number: ''
      });
    });

    // Do not await: scanning the QR code can take as long as the user needs.
    client.initialize().catch((err) => {
      console.error('[WhatsApp] Initialization failed:', err);
      client = null;
      setStatus({ status: 'error', error: err.message || 'Could not start WhatsApp.' });
    });

    return getStatus();
  } catch (err) {
    console.error('[WhatsApp] Connect error:', err);
    client = null;
    setStatus({ status: 'error', error: err.message || 'Could not start WhatsApp.' });
    return getStatus();
  } finally {
    initializing = false;
  }
}

// Called on app start: reconnect quietly if an owner number was configured.
function autoConnect() {
  try {
    const configured = normalizePhone(dbSettings().getSetting('whatsapp_owner_number'));
    if (configured) connect();
  } catch (err) {
    console.error('[WhatsApp] Auto-connect failed:', err);
  }
}

async function disconnect() {
  if (client) {
    try {
      await client.destroy();
    } catch (err) {
      console.error('[WhatsApp] Disconnect error:', err);
    }
    client = null;
  }
  setStatus({ status: 'disconnected', number: '', qr: '', error: '' });
  return getStatus();
}

// Called after the owner WhatsApp number changes. The old LocalAuth session
// belongs to the previous number, so it must be cleared before reconnecting;
// whatsapp-web.js will then emit a fresh QR code for the new number.
async function resetSession() {
  if (client) {
    // Ignore the expected disconnect event from the old client so it cannot
    // overwrite the "initializing" / "qr" state of the new client.
    client.removeAllListeners('disconnected');
  }
  await disconnect();

  try {
    fs.rmSync(sessionDir(), { recursive: true, force: true });
  } catch (err) {
    console.error('[WhatsApp] Could not clear old session:', err);
  }

  setStatus({ status: 'idle', number: '', qr: '', error: '' });

  const configured = normalizePhone(dbSettings().getSetting('whatsapp_owner_number'));
  if (!configured) return getStatus();

  return connect();
}

async function sendBillPdf({ phone, filePath, caption } = {}) {
  if (!client || state.status !== 'ready') {
    throw new Error('WhatsApp is not connected. Open Settings and scan the QR code first.');
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new Error('Invalid customer WhatsApp number. Enter a 10-digit Indian mobile number.');
  }

  const owner = ownerInfo();
  if (!owner.configured) {
    throw new Error('Add the owner WhatsApp number in Settings before sending bills.');
  }
  if (!owner.match) {
    throw new Error(
      `The logged-in WhatsApp number (${owner.connected || 'unknown'}) does not match the configured owner number (${owner.configured}).`
    );
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('The bill PDF could not be found. Please try again.');
  }

  const { MessageMedia } = loadWhatsAppWeb();
  const media = MessageMedia.fromFilePath(filePath);
  const chatId = `${normalizedPhone}@c.us`;

  const result = await client.sendMessage(chatId, caption || '', { media });
  console.log('[WhatsApp] Bill PDF sent to:', normalizedPhone);
  return { success: true, messageId: result?.id?.id || '' };
}

// Send a plain text message (used for bill cancellation notices).
async function sendText({ phone, message } = {}) {
  if (!client || state.status !== 'ready') {
    throw new Error('WhatsApp is not connected. Open Settings and scan the QR code first.');
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new Error('Invalid customer WhatsApp number. Enter a 10-digit Indian mobile number.');
  }

  const owner = ownerInfo();
  if (!owner.configured) {
    throw new Error('Add the owner WhatsApp number in Settings before sending messages.');
  }
  if (!owner.match) {
    throw new Error(
      `The logged-in WhatsApp number (${owner.connected || 'unknown'}) does not match the configured owner number (${owner.configured}).`
    );
  }

  const text = String(message || '').trim();
  if (!text) throw new Error('Message is empty.');

  await client.sendMessage(`${normalizedPhone}@c.us`, text);
  console.log('[WhatsApp] Text message sent to:', normalizedPhone);
  return { success: true };
}

async function shutdown() {
  if (client) {
    try {
      await client.destroy();
    } catch (err) {
      console.error('[WhatsApp] Shutdown error:', err);
    }
    client = null;
  }
}

module.exports = {
  setWindow,
  getStatus,
  autoConnect,
  connect,
  disconnect,
  resetSession,
  sendBillPdf,
  sendText,
  shutdown,
  normalizePhone
};
