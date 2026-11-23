// Registro en archivo para diagnosticar en la PC del cliente: %APPDATA%\PuntoVenta\logs\puntoventa.log
const fs = require('node:fs');
const path = require('node:path');

const MAX_BYTES = 5 * 1024 * 1024;

function createLogger(userDataDir) {
  const dir = path.join(userDataDir, 'logs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'puntoventa.log');

  // Rotación simple: si pasa de 5 MB se guarda como .1 y se empieza de nuevo.
  try {
    if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, `${file}.1`);
  } catch {
    /* aún no existe */
  }

  function write(level, message, error) {
    const detail = error ? ` ${error.stack ?? error}` : '';
    const line = `[${new Date().toISOString()}] ${level.padEnd(5)} ${message}${detail}\n`;
    try {
      fs.appendFileSync(file, line);
    } catch {
      /* sin disco: solo consola */
    }
    if (level === 'ERROR') console.error(line.trim());
    else console.log(line.trim());
  }

  return {
    file,
    info: (message) => write('INFO', message),
    warn: (message) => write('WARN', message),
    error: (message, error) => write('ERROR', message, error),
  };
}

module.exports = { createLogger };
