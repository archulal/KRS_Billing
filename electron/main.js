
// electron/main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const whatsapp = require('./whatsapp');

let mainWindow = null;
let expressServer = null;

const BACKEND_PORT = process.env.PORT || 4568;
const DEFAULT_PRINTER = 'G3000USB';

// ---------------------------------------------------------------
// Start embedded Express backend
async function startBackend() {
  try {
    const { startServer } = require('../server/index.js');
    const result = await startServer(BACKEND_PORT);

    expressServer = result.server;

    console.log(
      '[Electron] Embedded Express backend running on port:',
      BACKEND_PORT
    );
  } catch (err) {
    console.error('[Electron] Failed to start backend:', err);
  }
}

// ---------------------------------------------------------------
// Create browser window
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

  whatsapp.setWindow(mainWindow);

  const devUrl = process.env.VITE_DEV_SERVER_URL;

  if (devUrl) {
    console.log('[Electron] Loading Vite Dev Server:', devUrl);
    mainWindow.loadURL(devUrl);
  } else {
    const backendUrl = `http://127.0.0.1:${BACKEND_PORT}`;

    console.log('[Electron] Loading embedded backend:', backendUrl);

    mainWindow.webContents.on('did-fail-load', (event, errorCode) => {
      console.log('[Electron] Load failed:', errorCode);

      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(backendUrl);
        }
      }, 500);
    });

    mainWindow.loadURL(backendUrl);
  }

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    whatsapp.setWindow(null);
    mainWindow = null;
  });
}

// ---------------------------------------------------------------
// Global error handling
process.on('uncaughtException', (err) => {
  console.error('[Electron] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Electron] Unhandled Rejection:', reason);
});

// ---------------------------------------------------------------
// IPC: List available printers
ipcMain.handle('list-printers', async () => {
  console.log(
    '[Electron] list-printers invoked',
    'Version:',
    process.versions.electron
  );

  if (!mainWindow || mainWindow.isDestroyed()) {
    console.error('[Electron] Main window unavailable');
    return [];
  }

  const contents = mainWindow.webContents;

  if (contents.isDestroyed()) {
    console.error('[Electron] WebContents destroyed');
    return [];
  }

  if (typeof contents.getPrintersAsync !== 'function') {
    console.error('[Electron] Printer API unavailable');
    return [];
  }

  try {
    const printers = await contents.getPrintersAsync();

    console.log('[Electron] Printer count:', printers.length);

    printers.forEach((printer, index) => {
      console.log(`[Printer ${index + 1}]`, {
        name: printer.name,
        displayName: printer.displayName,
        isDefault: printer.isDefault,
        status: printer.status,
      });
    });

    return printers;
  } catch (error) {
    console.error('[Electron] Printer enumeration failed:', error);
    return [];
  }
});

// ---------------------------------------------------------------
// IPC: Normal print (dialog-based fallback)
//
// Note: Your earlier testing showed that webContents.print()
// crashes in your Linux environment. Keep this only if needed.
ipcMain.handle('print-to-printer', async (event, options = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return {
      success: false,
      failureReason: 'Window unavailable',
    };
  }

  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: false,
        printBackground: true,
        pageSize: options.pageSize || 'A5',
      },
      (success, failureReason) => {
        if (!success) {
          console.error('[Electron] Normal print failed:', failureReason);
        }

        resolve({ success, failureReason });
      }
    );
  });
});

// ---------------------------------------------------------------
// IPC: Prepare only the React invoice for PDF printing
//
// The invoice component must have:
// <div id="printable-receipt" className="... size-a5">
// or:
// <div id="printable-receipt" className="... size-a4">
//
// ---------------------------------------------------------------
async function prepareInvoiceForPrinting(contents, requestedSize, elementId = 'printable-receipt') {
  return contents.executeJavaScript(`
    (async () => {
      const receiptId = ${JSON.stringify(elementId || 'printable-receipt')};
      const receipt = document.getElementById(receiptId);

      if (!receipt) {
        throw new Error(
          'Printable element #' + receiptId + ' was not found'
        );
      }

      // Detect paper size from the React receipt class.
      const requestedSize = ${JSON.stringify(requestedSize || '')};

      const paperSize =
        requestedSize.toLowerCase() === 'a4' ||
        receipt.classList.contains('size-a4')
          ? 'A4'
          : 'A5';

      // Wait for fonts.
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Wait for receipt images, including the QR code.
      const images = Array.from(receipt.querySelectorAll('img'));

      await Promise.all(
        images.map((img) => {
          if (img.complete) {
            return Promise.resolve();
          }

          return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        })
      );

      // Allow React/browser layout to finish.
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });

      // Remove an earlier temporary print style if present.
      const oldStyle = document.getElementById(
        'krs-temporary-print-style'
      );

      if (oldStyle) {
        oldStyle.remove();
      }

      // Make receipt ancestors visible and remove modal clipping.
      let parent = receipt.parentElement;

      while (parent && parent !== document.body) {
        // Remember the original inline style once so it can be restored
        // after printing (the invoice preview must stay usable).
        if (!parent.hasAttribute('data-krs-original-style')) {
          parent.setAttribute(
            'data-krs-original-style',
            parent.getAttribute('style') || ''
          );
        }

        parent.style.setProperty('visibility', 'visible', 'important');
        parent.style.setProperty('display', 'block', 'important');
        parent.style.setProperty('overflow', 'visible', 'important');
        parent.style.setProperty('height', 'auto', 'important');
        parent.style.setProperty('max-height', 'none', 'important');
        parent.style.setProperty('transform', 'none', 'important');
        parent.style.setProperty('position', 'static', 'important');

        parent = parent.parentElement;
      }

      const style = document.createElement('style');

      style.id = 'krs-temporary-print-style';

      style.textContent = \`
        @media print {
          @page {
            size: \${paperSize} portrait;
            margin: 0;
          }

          html,
          body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          #${elementId},
          #${elementId} * {
            visibility: visible !important;
          }

          #${elementId} {
            position: relative !important;
            display: block !important;
            margin: 0 auto !important;
            padding: 0 !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            transform: none !important;
            box-shadow: none !important;
            background: white !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          .no-print,
          .invoice-modal-container,
          .invoice-modal-dialog,
          .invoice-scroll-area {
            box-shadow: none !important;
          }

          #${elementId} img {
            max-width: 100%;
          }
        }
      \`;

      document.head.appendChild(style);

      return {
        success: true,
        paperSize,
        receiptFound: true,
        imageCount: images.length,
        receiptClass: receipt.className
      };
    })();
  `);
}

// Undo the temporary layout changes made by prepareInvoiceForPrinting().
async function restoreInvoicePage(contents) {
  if (!contents || contents.isDestroyed()) return;

  try {
    await contents.executeJavaScript(`
      (() => {
        const style = document.getElementById('krs-temporary-print-style');
        if (style) style.remove();

        document.querySelectorAll('[data-krs-original-style]').forEach((element) => {
          const original = element.getAttribute('data-krs-original-style');
          if (original) {
            element.setAttribute('style', original);
          } else {
            element.removeAttribute('style');
          }
          element.removeAttribute('data-krs-original-style');
        });
      })();
    `);
  } catch (err) {
    console.error('[KRS] Failed to restore invoice page:', err);
  }
}

// ---------------------------------------------------------------
// IPC: Generate a PDF of the visible invoice for WhatsApp sharing.
// Uses the same printToPDF pipeline as silent printing so the PDF is
// identical to the printed bill (including Malayalam text and UPI QR).
// ---------------------------------------------------------------
ipcMain.handle('generate-bill-pdf', async (event, options = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Window unavailable' };
  }

  const contents = mainWindow.webContents;
  let prepared = false;

  try {
    const preparation = await prepareInvoiceForPrinting(contents, 'A5');
    if (!preparation.success) throw new Error('Invoice is not visible');

    prepared = true;

    const pdfBuffer = await contents.printToPDF({
      pageSize: 'A5',
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: true
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF is empty');
    }

    const pdfDir = path.join(app.getPath('userData'), 'bill-pdfs');
    await fs.promises.mkdir(pdfDir, { recursive: true });

    const safeName = String(options.billNumber || 'bill').replace(/[^A-Za-z0-9_-]/g, '_');
    const filePath = path.join(pdfDir, `${safeName}.pdf`);
    await fs.promises.writeFile(filePath, pdfBuffer);

    return { success: true, filePath };
  } catch (err) {
    console.error('[KRS PDF] Failed to generate bill PDF:', err);
    return { success: false, error: err.message || 'Could not generate PDF' };
  } finally {
    if (prepared) await restoreInvoicePage(contents);
  }
});

// ---------------------------------------------------------------
// IPC: Generate a PDF of the visible customer ledger statement.
// Mirrors the bill PDF pipeline, but uses the A4 ledger element.
// ---------------------------------------------------------------
ipcMain.handle('generate-ledger-pdf', async (event, options = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Window unavailable' };
  }

  const contents = mainWindow.webContents;
  let prepared = false;

  try {
    const preparation = await prepareInvoiceForPrinting(contents, 'A4', 'printable-ledger');
    if (!preparation.success) throw new Error('Ledger is not visible');

    prepared = true;

    const pdfBuffer = await contents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: true
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF is empty');
    }

    const pdfDir = path.join(app.getPath('userData'), 'ledger-pdfs');
    await fs.promises.mkdir(pdfDir, { recursive: true });

    const safeName = String(options.fileName || 'ledger').replace(/[^A-Za-z0-9_-]/g, '_');
    const filePath = path.join(pdfDir, `${safeName}.pdf`);
    await fs.promises.writeFile(filePath, pdfBuffer);

    return { success: true, filePath };
  } catch (err) {
    console.error('[KRS PDF] Failed to generate ledger PDF:', err);
    return { success: false, error: err.message || 'Could not generate PDF' };
  } finally {
    if (prepared) await restoreInvoicePage(contents);
  }
});

// ---------------------------------------------------------------
// IPC: Silent invoice printing
//
// Flow:
// React invoice -> PDF -> temporary file -> CUPS -> printer
//
// ---------------------------------------------------------------
ipcMain.handle('print-silent', async (event, options = {}) => {
  console.log('[KRS Print] Starting invoice PDF printing');

  if (!mainWindow || mainWindow.isDestroyed()) {
    return {
      success: false,
      failureReason: 'Window unavailable',
    };
  }

  const contents = mainWindow.webContents;

  if (contents.isDestroyed()) {
    return {
      success: false,
      failureReason: 'WebContents unavailable',
    };
  }

  let tempDir = null;
  let printStyleAdded = false;

  try {
    // Step 1: Prepare invoice element.
    console.log('[KRS Print] Preparing invoice element');

    const preparation = await prepareInvoiceForPrinting(
      contents,
      options.paperSize,
      options.elementId
    );

    if (!preparation.success) {
      throw new Error('Could not prepare invoice for printing');
    }

    printStyleAdded = true;

    const pageSize = preparation.paperSize;

    console.log('[KRS Print] Paper size:', pageSize);
    console.log('[KRS Print] Receipt class:', preparation.receiptClass);
    console.log('[KRS Print] Images detected:', preparation.imageCount);

    // Step 2: Generate PDF only once.
    console.log('[KRS Print] Generating PDF');

    const pdfBuffer = await contents.printToPDF({
      pageSize,
      printBackground: true,
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
      preferCSSPageSize: true,
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF is empty');
    }

    console.log(
      '[KRS Print] PDF generated successfully:',
      pdfBuffer.length,
      'bytes'
    );

    // Step 3: Save temporary PDF.
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'krs-print-')
    );

    const pdfPath = path.join(tempDir, 'receipt.pdf');

    await fs.promises.writeFile(pdfPath, pdfBuffer);

    console.log('[KRS Print] PDF saved:', pdfPath);

    // Step 4: Submit PDF to CUPS.
    const printer = options.printer || DEFAULT_PRINTER;

    console.log('[KRS Print] Sending to printer:', printer);

    const result = await new Promise((resolve, reject) => {
      const lp = spawn('lp', [
        '-d',
        printer,
        '-o',
        `media=${pageSize}`,
        pdfPath,
      ]);

      let stdout = '';
      let stderr = '';

      lp.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      lp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      lp.on('error', (error) => {
        reject(error);
      });

      lp.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(
            new Error(
              stderr || `CUPS lp command exited with code ${code}`
            )
          );
        }
      });
    });

    console.log('[KRS Print] CUPS submitted:', result.stdout);

    return {
      success: true,
      printer,
      pageSize,
      message: result.stdout.trim(),
    };

  } catch (error) {
    console.error('[KRS Print] Printing failed:', error);

    return {
      success: false,
      failureReason: error.message,
    };

  } finally {
    // Step 5: Restore page by removing temporary print CSS.
    if (printStyleAdded) {
      await restoreInvoicePage(contents);
    }

    // Step 6: Remove temporary PDF directory.
    if (tempDir) {
      await fs.promises.rm(tempDir, {
        recursive: true,
        force: true,
      }).catch((error) => {
        console.error('[KRS Print] Temp cleanup failed:', error);
      });
    }
  }
});

// ---------------------------------------------------------------
// IPC: WhatsApp Web connection and bill delivery
// ---------------------------------------------------------------
ipcMain.handle('whatsapp:get-status', () => whatsapp.getStatus());
ipcMain.handle('whatsapp:connect', () => whatsapp.connect());
ipcMain.handle('whatsapp:disconnect', () => whatsapp.disconnect());
ipcMain.handle('whatsapp:reset-session', () => whatsapp.resetSession());
ipcMain.handle('whatsapp:send-bill', (event, payload) => whatsapp.sendBillPdf(payload));
ipcMain.handle('whatsapp:send-text', (event, payload) => whatsapp.sendText(payload));

// ---------------------------------------------------------------
// App lifecycle
app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');

  process.env.KRS_DATA_DIR = path.join(
    userDataPath,
    'database'
  );

  // Packaged builds are always production. Explicit KRS_ENV (for example
  // from `npm start`) wins so the app never seeds demo customers in a shop.
  process.env.KRS_ENV =
    process.env.KRS_ENV || (app.isPackaged ? 'production' : 'development');

  console.log('[Electron] App ready');
  console.log('[Electron] Environment:', process.env.KRS_ENV);
  console.log('[Electron] User data path:', userDataPath);

  await startBackend();

  createWindow();

  // Reconnect WhatsApp automatically when an owner number is configured.
  whatsapp.autoConnect();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (expressServer) {
    expressServer.close();
    expressServer = null;
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  whatsapp.shutdown();
});
