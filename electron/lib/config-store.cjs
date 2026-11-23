// Configuración por PC: %APPDATA%\PuntoVenta\config.json
// - apiUrl: si tiene valor, la app usa ese servidor y NO lanza el backend embebido
//   (para mover el backend a un servidor central sin recompilar).
// - scale: báscula de esta PC (deshabilitada = el cajero escribe el peso).
// - printer: impresora de tickets de esta PC.
const fs = require('node:fs');
const path = require('node:path');

const BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];
const PARITIES = ['none', 'even', 'odd'];

const DEFAULT_SCALE = Object.freeze({
  enabled: false,
  path: '',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  /** continuous: la báscula manda el peso sola · request: hay que pedírselo con `command`. */
  mode: 'continuous',
  command: 'P',
  intervalMs: 300,
  /** Para reencontrar el adaptador USB si Windows le cambia el COM. */
  match: { serialNumber: '', vendorId: '', productId: '' },
});

const DEFAULT_PRINTER = Object.freeze({
  /** Nombre de la impresora en Windows; vacío = no imprimir. */
  name: '',
  widthMm: 80,
  autoPrint: false,
  copies: 1,
});

const DEFAULTS = Object.freeze({ apiUrl: '', scale: DEFAULT_SCALE, printer: DEFAULT_PRINTER });

function configFile(userDataDir) {
  return path.join(userDataDir, 'config.json');
}

function loadConfig(userDataDir, log) {
  const file = configFile(userDataDir);
  if (!fs.existsSync(file)) {
    try {
      writeAtomic(file, DEFAULTS);
      log.info(`Configuración creada en ${file}`);
    } catch (error) {
      log.error(`No se pudo crear ${file}`, error);
    }
    return withDefaults({});
  }
  try {
    return withDefaults(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    log.error(`config.json inválido, se usan valores por defecto (${file})`, error);
    return withDefaults({});
  }
}

function saveConfig(userDataDir, config) {
  writeAtomic(configFile(userDataDir), config);
}

/** Escribe a un temporal y renombra: un apagón no deja el archivo a medias. */
function writeAtomic(file, data) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temp, file);
}

function withDefaults(raw) {
  return {
    ...DEFAULTS,
    ...raw,
    scale: sanitizeScale(raw.scale ?? {}),
    printer: sanitizePrinter(raw.printer ?? {}),
  };
}

/** Valida lo que llega de la ventana o del archivo: solo valores conocidos. */
function sanitizeScale(input) {
  const s = { ...DEFAULT_SCALE, ...(isObject(input) ? input : {}) };
  return {
    enabled: s.enabled === true,
    path: text(s.path, 64),
    baudRate: BAUD_RATES.includes(Number(s.baudRate)) ? Number(s.baudRate) : 9600,
    dataBits: [7, 8].includes(Number(s.dataBits)) ? Number(s.dataBits) : 8,
    parity: PARITIES.includes(s.parity) ? s.parity : 'none',
    stopBits: [1, 2].includes(Number(s.stopBits)) ? Number(s.stopBits) : 1,
    mode: s.mode === 'request' ? 'request' : 'continuous',
    command: text(s.command, 16) || 'P',
    intervalMs: clampInt(s.intervalMs, 100, 5000, 300),
    match: {
      serialNumber: text(s.match?.serialNumber, 64),
      vendorId: text(s.match?.vendorId, 8),
      productId: text(s.match?.productId, 8),
    },
  };
}

function sanitizePrinter(input) {
  const p = { ...DEFAULT_PRINTER, ...(isObject(input) ? input : {}) };
  return {
    name: text(p.name, 200),
    widthMm: [58, 80].includes(Number(p.widthMm)) ? Number(p.widthMm) : 80,
    autoPrint: p.autoPrint === true,
    copies: clampInt(p.copies, 1, 3, 1),
  };
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
function clampInt(value, min, max, fallback) {
  const n = Number(value);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

module.exports = {
  BAUD_RATES,
  loadConfig,
  saveConfig,
  sanitizePrinter,
  sanitizeScale,
};
