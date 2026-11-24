// Puente seguro entre Electron y Angular (contextIsolation + sandbox).
// Angular lo lee como `window.pos` (ver src/app/core/config/pos-bridge.ts).
const { contextBridge, ipcRenderer } = require('electron');

// Configuración de esta carga (apiUrl del backend, versión). Sincrónico a propósito: Angular la
// lee al iniciar. La ventana se crea antes de que el backend esté listo; la app se carga después,
// cuando la apiUrl ya existe.
let config = {};
try {
  config = ipcRenderer.sendSync('pos:config') ?? {};
} catch {
  config = {};
}

/** Suscripción a un evento del proceso principal; devuelve la función para cancelarla. */
function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('pos', {
  config: Object.freeze({ ...config }),
  hardware: {
    getConfig: () => ipcRenderer.invoke('hardware:get-config'),
  },
  scale: {
    getState: () => ipcRenderer.invoke('scale:state'),
    saveConfig: (scale) => ipcRenderer.invoke('scale:save-config', scale),
    listPorts: () => ipcRenderer.invoke('scale:list-ports'),
    detect: () => ipcRenderer.invoke('scale:detect'),
    onStatus: (callback) => subscribe('scale:status', callback),
    onReading: (callback) => subscribe('scale:reading', callback),
    onDetectProgress: (callback) => subscribe('scale:detect-progress', callback),
  },
  printer: {
    list: () => ipcRenderer.invoke('printer:list'),
    saveConfig: (printer) => ipcRenderer.invoke('printer:save-config', printer),
    print: (job) => ipcRenderer.invoke('printer:print', job),
  },
});
