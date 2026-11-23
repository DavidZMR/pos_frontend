// Hardware de esta PC (báscula; impresora en lib/printer) expuesto a la ventana por IPC.
// Todo es opcional: si el controlador serial no carga o no hay báscula, la app sigue
// funcionando y el cajero escribe el peso.
const { ipcMain } = require('electron');
const { sanitizeScale, saveConfig } = require('./config-store.cjs');
const { detectScale } = require('./scale/detect.cjs');
const { ScaleService } = require('./scale/scale-service.cjs');

function loadSerialPort(log) {
  try {
    const { SerialPort } = require('serialport');
    log.info('Controlador serial cargado (serialport)');
    return SerialPort;
  } catch (error) {
    log.error('No se pudo cargar el controlador serial; la báscula queda deshabilitada', error);
    return null;
  }
}

/**
 * @param {{ config: any, userDataDir: string, log: any, getWindow: () => any,
 *   isTrustedSender: (event: any) => boolean }} options
 */
function setupHardware({ config, userDataDir, log, getWindow, isTrustedSender }) {
  const SerialPort = loadSerialPort(log);
  let current = config;

  const persist = (next) => {
    current = next;
    try {
      saveConfig(userDataDir, next);
    } catch (error) {
      log.error('No se pudo guardar la configuración de hardware', error);
    }
  };
  const send = (channel, payload) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };
  /** Solo la UI de la app (app://pos o el servidor de desarrollo) puede usar el hardware. */
  const handle = (channel, fn) =>
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrustedSender(event)) throw new Error('Origen no permitido');
      return fn(event, ...args);
    });

  // ---- Báscula ----
  const scale = new ScaleService({
    SerialPort,
    log,
    onPathMoved: (path) => persist({ ...current, scale: { ...current.scale, path } }),
  });
  scale.on('status', (status) => send('scale:status', status));
  scale.on('reading', (reading) => send('scale:reading', reading));
  scale.configure(current.scale);

  handle('hardware:get-config', () => ({ scale: current.scale, printer: current.printer }));

  handle('scale:state', () => scale.snapshot());

  handle('scale:save-config', (_event, input) => {
    const next = sanitizeScale(input);
    persist({ ...current, scale: next });
    log.info(
      next.enabled
        ? `Báscula configurada: ${next.path} ${next.baudRate} ${next.dataBits}${next.parity[0].toUpperCase()}${next.stopBits} (${next.mode})`
        : 'Báscula deshabilitada (captura manual del peso)',
    );
    scale.configure(next);
    return next;
  });

  handle('scale:list-ports', async () => {
    if (!SerialPort) return [];
    const ports = await SerialPort.list();
    return ports.map((p) => ({
      path: p.path,
      label: [p.path, p.friendlyName?.replace(/\s*\(COM\d+\)$/, '') || p.manufacturer]
        .filter(Boolean)
        .join(' · '),
      serialNumber: p.serialNumber ?? '',
      vendorId: p.vendorId ?? '',
      productId: p.productId ?? '',
    }));
  });

  let detecting = false;
  handle('scale:detect', async (event) => {
    if (!SerialPort) {
      return { scale: null, message: 'No se pudo cargar el controlador del puerto serial' };
    }
    if (detecting) throw new Error('Ya se está buscando la báscula');
    detecting = true;
    scale.stop(); // libera el puerto actual para poder probarlo
    try {
      // El mensaje final viaja en la respuesta: Electron no garantiza que un evento enviado
      // con webContents.send llegue antes que la respuesta del invoke.
      let message = '';
      const found = await detectScale({
        SerialPort,
        onProgress: (text) => {
          message = text;
          event.sender.send('scale:detect-progress', text);
        },
      });
      log.info(found ? `Báscula detectada en ${found.path}` : 'Búsqueda de báscula sin resultado');
      return { scale: found, message };
    } finally {
      detecting = false;
      scale.configure(current.scale);
    }
  });

  return {
    stop: () => scale.stop(),
  };
}

module.exports = { setupHardware };
