// Lanza el backend embebido con el Node que trae Electron (la PC no necesita Node instalado).
// Lección de Construcciones JJ: spawn + ELECTRON_RUN_AS_NODE, nunca fork().
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const READY = /POS_BACKEND_READY port=(\d+)/;

/**
 * @returns {Promise<{ port: number, stop: () => void }>}
 */
function startBackend({ backendDir, log, corsOrigin, timeoutMs = 30_000 }) {
  // Instalador: un solo archivo (server.cjs, empaquetado con esbuild). Sin empaquetar: dist/.
  const bundled = path.join(backendDir, 'server.cjs');
  const entry = fs.existsSync(bundled) ? bundled : path.join(backendDir, 'dist', 'server.js');
  if (!fs.existsSync(entry)) {
    return Promise.reject(new Error(`No se encontró el backend en ${entry}`));
  }
  log.info(`Iniciando backend: ${entry}`);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry], {
      cwd: backendDir, // el backend lee su .env desde aquí
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '0', // puerto libre asignado por el sistema
        CORS_ORIGINS: corsOrigin,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        child.kill();
        reject(error);
      } else {
        resolve(value);
      }
    };
    const timer = setTimeout(
      () => finish(new Error('El servidor interno tardó demasiado en iniciar')),
      timeoutMs,
    );

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (!line.trim()) continue;
        log.info(`[backend] ${line}`);
        const match = READY.exec(line);
        if (match) {
          finish(null, {
            port: Number(match[1]),
            stop: () => {
              if (!child.killed) child.kill();
            },
          });
        }
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => log.error(`[backend] ${chunk.trim()}`));
    child.on('error', (error) => finish(error));
    child.on('exit', (code, signal) => {
      log.warn(`Backend terminó (code=${code}, signal=${signal})`);
      finish(new Error(`El servidor interno se cerró al iniciar (código ${code})`));
    });
  });
}

module.exports = { startBackend };
