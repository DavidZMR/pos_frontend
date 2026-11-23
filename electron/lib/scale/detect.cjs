// "Buscar báscula": prueba los puertos COM con las configuraciones más comunes y devuelve la
// primera que entrega un peso legible. Primero solo escucha (básculas en modo continuo); si no
// llega nada, manda los comandos de petición más usados.
const { FrameSplitter, decodeCommand, parseWeightFrame } = require('./frames.cjs');

/** Configuraciones típicas en México (Torrey, Rhino, CAS, Ohaus, Mettler), de la más común a la menos. */
const LINE_SETTINGS = [
  { baudRate: 9600, dataBits: 8, parity: 'none', stopBits: 1 },
  { baudRate: 4800, dataBits: 8, parity: 'none', stopBits: 1 },
  { baudRate: 2400, dataBits: 8, parity: 'none', stopBits: 1 },
  { baudRate: 19200, dataBits: 8, parity: 'none', stopBits: 1 },
  { baudRate: 9600, dataBits: 7, parity: 'even', stopBits: 1 },
];
/** P: Torrey/Ohaus · W: Brecknell/Avery · ENQ: CAS/Rhino · SI: Mettler (SICS). */
const REQUEST_COMMANDS = ['P', 'W', '\\x05', 'SI\\r\\n'];

const LISTEN_MS = 700;
const ANSWER_MS = 400;

/**
 * @param {{ SerialPort: any, onProgress?: (message: string) => void, listenMs?: number, answerMs?: number }} options
 * @returns {Promise<null | object>} configuración lista para guardar, o null
 */
async function detectScale({
  SerialPort,
  onProgress = () => {},
  listenMs = LISTEN_MS,
  answerMs = ANSWER_MS,
}) {
  const ports = await SerialPort.list();
  if (!ports.length) {
    onProgress('No hay puertos COM en esta PC. Conecta la báscula (cable USB o serial).');
    return null;
  }
  for (const info of ports) {
    for (const line of LINE_SETTINGS) {
      onProgress(`Probando ${info.path} a ${line.baudRate} baudios…`);
      const found = await probe(SerialPort, info.path, line, listenMs, answerMs);
      if (found) {
        onProgress(`Báscula encontrada en ${info.path}`);
        return {
          enabled: true,
          path: info.path,
          ...line,
          mode: found.command ? 'request' : 'continuous',
          command: found.command ?? 'P',
          intervalMs: 300,
          match: portMatch(info),
          sampleGrams: found.grams,
        };
      }
    }
  }
  onProgress('No se encontró una báscula. Revisa que esté encendida y conectada.');
  return null;
}

/** Abre el puerto con una configuración; devuelve el primer peso que llegue y con qué comando. */
async function probe(SerialPort, path, line, listenMs, answerMs) {
  const port = new SerialPort({ path, ...line, autoOpen: false });
  const opened = await new Promise((resolve) => port.open((error) => resolve(!error)));
  if (!opened) return null;

  const splitter = new FrameSplitter();
  let found = null;
  port.on('data', (chunk) => {
    if (found) return;
    for (const frame of splitter.push(chunk)) {
      const parsed = parseWeightFrame(frame);
      if (parsed) {
        found = { grams: parsed.grams };
        break;
      }
    }
  });
  port.on('error', () => {});

  try {
    await wait(listenMs);
    if (found) return found;
    for (const command of REQUEST_COMMANDS) {
      port.write(decodeCommand(command));
      await wait(answerMs);
      if (found) return { ...found, command };
    }
    return null;
  } finally {
    await new Promise((resolve) => (port.isOpen ? port.close(() => resolve()) : resolve()));
  }
}

function portMatch(info) {
  return {
    serialNumber: info.serialNumber ?? '',
    vendorId: info.vendorId ?? '',
    productId: info.productId ?? '',
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = { LINE_SETTINGS, REQUEST_COMMANDS, detectScale, portMatch };
