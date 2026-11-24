// Proceso principal de la app de escritorio (Electron).
// Flujo: instancia única → protocolo app:// para la UI → backend embebido (o API externa) → ventana.
const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { DATA_DIR, DISPLAY_NAME, LEAD, STRONG } = require('./branding.cjs');
const { startBackend } = require('./lib/backend.cjs');
const { loadConfig } = require('./lib/config-store.cjs');
const { setupHardware } = require('./lib/hardware.cjs');
const { createLogger } = require('./lib/logger.cjs');

const APP_SCHEME = 'app';
const APP_ORIGIN = 'app://pos';
const UI_DIR = path.join(__dirname, 'ui');
/** En desarrollo: `ng serve` (p. ej. http://localhost:4200). */
const DEV_SERVER_URL = process.env.POS_DEV_SERVER_URL || '';

// La UI se sirve desde app://pos/ (no file://): rutas normales de Angular y orígen CORS estable.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

// Carpeta de datos fija (config.json, registro) aunque cambie el nombre visible. Las pruebas
// pasan --user-data-dir para aislarse; se respeta.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getPath('appData'), DATA_DIR));
}

// Menos procesos = arranque más rápido. Algunos antivirus (medido con McAfee) revisan CADA proceso
// que abre la app: ~10–13 s por proceso. El GPU y el servicio de red corren dentro del proceso
// principal (medido: 57.7 s → 34.7 s hasta el inicio de sesión en una PC con McAfee).
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('enable-features', 'NetworkServiceInProcess2');

/** Página de arranque: se sirve desde app://pos para que la app cargue en el MISMO proceso. */
const STARTUP_PATH = '__arranque';

let log;
let mainWindow = null;
let backend = null;
let hardware = null;
/** Lo que el preload entrega a Angular como `window.pos.config` (apiUrl se conoce al final). */
let runtimeConfig = { apiUrl: '', appVersion: app.getVersion() };

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(boot);

  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => {
    hardware?.stop();
    backend?.stop();
  });
}

async function boot() {
  log = createLogger(app.getPath('userData'));
  log.info(
    `=== ${DISPLAY_NAME} v${app.getVersion()} | Electron ${process.versions.electron} | ` +
      `Node ${process.versions.node} | empaquetado=${app.isPackaged} ===`,
  );
  Menu.setApplicationMenu(null);
  registerUiProtocol();
  // El preload pide la configuración al cargar cada página (sincrónico: Angular la lee al iniciar).
  ipcMain.on('pos:config', (event) => {
    event.returnValue = isTrustedSender(event) ? runtimeConfig : {};
  });

  // La ventana se abre YA con "Iniciando…" mientras arranca el backend (sin ventana extra).
  createMainWindow();
  try {
    const config = loadConfig(app.getPath('userData'), log);
    // El hardware es opcional: si falla, la app sigue (peso a mano, sin imprimir).
    try {
      hardware = setupHardware({
        config,
        userDataDir: app.getPath('userData'),
        log,
        getWindow: () => mainWindow,
        isTrustedSender,
      });
    } catch (error) {
      log.error('No se pudo iniciar el hardware', error);
    }
    const apiUrl = await resolveApiUrl(config);
    log.info(`API: ${apiUrl}`);
    runtimeConfig = { apiUrl, appVersion: app.getVersion() };
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadURL(DEV_SERVER_URL || `${APP_ORIGIN}/`);
    }
  } catch (error) {
    log.error('No se pudo iniciar la aplicación', error);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
    dialog.showErrorBox(
      `${DISPLAY_NAME} no pudo iniciar`,
      `${error.message}\n\nDetalle en el registro:\n${log.file}`,
    );
    app.quit();
  }
}

/** API externa (POS_API_URL o config.json) o backend embebido en un puerto libre. */
async function resolveApiUrl(config) {
  const external = process.env.POS_API_URL || config.apiUrl;
  if (external) {
    log.info('Usando API externa; no se lanza el backend embebido');
    return external.replace(/\/+$/, '');
  }

  const backendDir = app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.resolve(__dirname, '..', '..', 'pos_backend');
  backend = await startBackend({
    backendDir,
    log,
    corsOrigin: DEV_SERVER_URL || APP_ORIGIN,
  });
  return `http://127.0.0.1:${backend.port}/api`;
}

/** Peticiones IPC solo desde la UI de la app (nunca desde una página externa). */
function isTrustedSender(event) {
  const url = event.senderFrame?.url ?? '';
  return url.startsWith(APP_ORIGIN) || Boolean(DEV_SERVER_URL && url.startsWith(DEV_SERVER_URL));
}

function registerUiProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
    if (relative === STARTUP_PATH) {
      return new Response(startupHtml(), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    let file = path.normalize(path.join(UI_DIR, relative));
    if (!file.startsWith(UI_DIR)) return new Response('Prohibido', { status: 403 });

    // Cualquier ruta de Angular (/inicio, /usuarios…) devuelve index.html.
    const isFile = relative && fs.existsSync(file) && fs.statSync(file).isFile();
    if (!isFile) file = path.join(UI_DIR, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: DISPLAY_NAME,
    backgroundColor: '#0B2E40',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Enlaces externos se abren en el navegador; la ventana nunca sale de la app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith(APP_ORIGIN) || (DEV_SERVER_URL && url.startsWith(DEV_SERVER_URL));
    if (!allowed) event.preventDefault();
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error(`La ventana se cerró inesperadamente: ${details.reason}`);
  });
  mainWindow.webContents.on('console-message', (event) => {
    if (event.level === 'error') log.warn(`[ui] ${event.message}`);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Primero la pantalla de arranque; boot() carga la app en esta misma ventana al estar listo.
  void mainWindow.loadURL(`${APP_ORIGIN}/${STARTUP_PATH}`);
}

/** "Iniciando…" (mismo origen que la app: no abre otro proceso de ventana). */
function startupHtml() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${DISPLAY_NAME}</title><style>
    html,body{margin:0;height:100%;background:#0B2E40;color:#EEF7FB;font-family:"Segoe UI",system-ui,sans-serif}
    body{display:grid;place-items:center;text-align:center}
    .name{font-size:34px;letter-spacing:-.02em;font-weight:300}.name b{font-weight:800}
    .msg{margin-top:10px;font-size:13px;color:#9FB8C6}
    .bar{margin:22px auto 0;width:160px;height:3px;background:#1d4459;border-radius:3px;overflow:hidden}
    .bar i{display:block;width:40%;height:100%;background:#2BA3B8;animation:m 1.2s cubic-bezier(.65,0,.35,1) infinite}
    @keyframes m{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
  </style></head><body><div><div class="name">${LEAD} <b>${STRONG}</b></div>
  <div class="msg">Iniciando…</div><div class="bar"><i></i></div></div></body></html>`;
}
