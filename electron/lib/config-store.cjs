// Configuración por PC: %APPDATA%\PuntoVenta\config.json
// - apiUrl: si tiene valor, la app usa ese servidor y NO lanza el backend embebido
//   (para mover el backend a un servidor central sin recompilar).
// - Más adelante: báscula e impresora de esta PC.
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = Object.freeze({ apiUrl: '' });

function loadConfig(userDataDir, log) {
  const file = path.join(userDataDir, 'config.json');
  if (!fs.existsSync(file)) {
    try {
      fs.writeFileSync(file, `${JSON.stringify(DEFAULTS, null, 2)}\n`);
      log.info(`Configuración creada en ${file}`);
    } catch (error) {
      log.error(`No se pudo crear ${file}`, error);
    }
    return { ...DEFAULTS };
  }
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (error) {
    log.error(`config.json inválido, se usan valores por defecto (${file})`, error);
    return { ...DEFAULTS };
  }
}

module.exports = { loadConfig };
