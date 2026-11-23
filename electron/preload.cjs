// Puente seguro entre Electron y Angular (contextIsolation + sandbox).
// Angular lo lee como `window.pos` (ver src/app/core/config/pos-bridge.ts).
const { contextBridge, ipcRenderer } = require('electron');

const PREFIX = '--pos-config=';
let config = {};
try {
  const arg = process.argv.find((value) => value.startsWith(PREFIX));
  if (arg) config = JSON.parse(decodeURIComponent(arg.slice(PREFIX.length)));
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
