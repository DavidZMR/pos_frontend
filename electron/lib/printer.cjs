// Impresión de tickets: HTML (armado en la UI) → ventana oculta → impresora de Windows, sin
// diálogo. Funciona con térmicas de 58/80 mm vía su controlador de Windows (sin librerías nativas).
const { BrowserWindow } = require('electron');

const PX_PER_MM = 96 / 25.4;
const PRINT_TIMEOUT_MS = 30_000;

/** Impresoras instaladas en Windows (para elegir y para saber si la configurada existe). */
async function listPrinters(webContents) {
  const printers = await webContents.getPrintersAsync();
  return printers.map((p) => ({
    name: p.name,
    displayName: p.displayName || p.name,
    isDefault: Boolean(p.isDefault),
  }));
}

/**
 * Imprime un documento HTML completo. El alto de la página se mide del contenido para que el
 * rollo térmico no se corte en hojas.
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function printHtml({ html, deviceName, widthMm, copies, log }) {
  const win = new BrowserWindow({
    show: false,
    width: Math.round(widthMm * PX_PER_MM),
    // Bajita: el alto del documento nunca es menor que la ventana; se mide el body (contenido).
    height: 100,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    // documentElement.scrollHeight nunca es menor que la ventana: un ticket corto saldría con
    // centímetros de papel en blanco. Se mide el body, que mide exactamente el contenido.
    const heightPx = await win.webContents.executeJavaScript(
      'Math.ceil(document.body.getBoundingClientRect().height)',
    );
    // Micras. Mínimo 30 mm para que los controladores no rechacen páginas diminutas.
    const heightMicrons = Math.max(30_000, Math.ceil((heightPx / PX_PER_MM) * 1000) + 2_000);

    const result = await new Promise((resolve) => {
      const timer = setTimeout(
        () => resolve({ ok: false, error: 'La impresora no respondió (tiempo agotado)' }),
        PRINT_TIMEOUT_MS,
      );
      win.webContents.print(
        {
          silent: true,
          deviceName,
          printBackground: true,
          copies,
          margins: { marginType: 'none' },
          pageSize: { width: widthMm * 1000, height: heightMicrons },
        },
        (success, failureReason) => {
          clearTimeout(timer);
          resolve(success ? { ok: true } : { ok: false, error: friendlyPrintError(failureReason) });
        },
      );
    });
    if (result.ok)
      log.info(`Ticket impreso en "${deviceName}" (${widthMm} mm, ${copies} copia(s))`);
    else log.warn(`No se pudo imprimir en "${deviceName}": ${result.error}`);
    return result;
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

function friendlyPrintError(reason) {
  if (!reason) return 'Error desconocido de la impresora';
  if (/cancel/i.test(reason)) return 'Se canceló la impresión';
  if (/invalid (printer|device)|printer.*not.*found/i.test(reason)) {
    return 'La impresora no está disponible (revisa que esté conectada y encendida)';
  }
  return reason;
}

module.exports = { listPrinters, printHtml };
