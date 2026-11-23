// Puente seguro entre Electron y Angular (contextIsolation + sandbox).
// Angular lo lee en ConfigService como `window.pos.config`.
const { contextBridge } = require('electron');

const PREFIX = '--pos-config=';
let config = {};
try {
  const arg = process.argv.find((value) => value.startsWith(PREFIX));
  if (arg) config = JSON.parse(decodeURIComponent(arg.slice(PREFIX.length)));
} catch {
  config = {};
}

contextBridge.exposeInMainWorld('pos', {
  config: Object.freeze({ ...config }),
});
