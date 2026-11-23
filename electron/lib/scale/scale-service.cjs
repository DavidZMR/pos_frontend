// Báscula serial de esta PC: abre el puerto, lee el peso y avisa a la ventana.
// Se reconecta sola si se desconecta el cable y sigue al adaptador USB si Windows le cambia el COM.
const { EventEmitter } = require('node:events');
const {
  FrameSplitter,
  StabilityTracker,
  decodeCommand,
  parseWeightFrame,
} = require('./frames.cjs');

const RETRY_MS = 3000;
/** Sin tramas durante este tiempo = la báscula no está respondiendo. */
const SILENCE_MS = 2500;

/**
 * Estados (para la UI):
 *  - disabled: no hay báscula configurada en esta PC (se captura el peso a mano).
 *  - connecting: abriendo el puerto.
 *  - waiting: puerto abierto pero la báscula no manda datos (apagada, velocidad equivocada…).
 *  - connected: llegan pesos.
 *  - error: el puerto no existe o no se pudo abrir; se reintenta solo.
 */
class ScaleService extends EventEmitter {
  /**
   * @param {{ SerialPort: any, log: any, onPathMoved?: (path: string) => void, now?: () => number,
   *   retryMs?: number, silenceMs?: number }} deps
   */
  constructor({
    SerialPort,
    log,
    onPathMoved,
    now = Date.now,
    retryMs = RETRY_MS,
    silenceMs = SILENCE_MS,
  }) {
    super();
    this.retryMs = retryMs;
    this.silenceMs = silenceMs;
    this.SerialPort = SerialPort;
    this.log = log;
    this.onPathMoved = onPathMoved;
    this.now = now;
    this.config = null;
    this.state = { state: 'disabled', message: 'Sin báscula configurada', path: '' };
    this.reading = null;
    this.port = null;
    this.timers = new Set();
    this.generation = 0;
    this.splitter = new FrameSplitter();
    this.stability = new StabilityTracker();
    this.lastFrameAt = 0;
  }

  /** Aplica (o reaplica) la configuración. Cierra la conexión anterior. */
  configure(config) {
    this.stop();
    this.config = config;
    if (!config?.enabled || !config.path) {
      this.#setState('disabled', 'Sin báscula configurada', '');
      return;
    }
    if (!this.SerialPort) {
      this.#setState('error', 'No se pudo cargar el controlador del puerto serial', config.path);
      return;
    }
    void this.#connect(this.generation);
  }

  /** Cierra el puerto y detiene reintentos (p. ej. antes de buscar básculas). */
  stop() {
    this.generation += 1;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    const port = this.port;
    this.port = null;
    if (port?.isOpen) port.close(() => {});
    this.splitter.reset();
    this.stability.reset();
    this.#setReading(null);
  }

  snapshot() {
    return { status: this.state, reading: this.reading };
  }

  async #connect(generation) {
    const config = this.config;
    this.#setState('connecting', `Conectando con la báscula en ${config.path}…`, config.path);

    let path = config.path;
    try {
      const ports = await this.SerialPort.list();
      if (generation !== this.generation) return;
      if (!ports.some((p) => p.path === path)) {
        const moved = findMovedPort(ports, config.match);
        if (!moved) {
          this.#setState('error', `No se encontró la báscula en ${config.path}`, config.path);
          this.#retry(generation);
          return;
        }
        this.log.info(`Báscula: el adaptador pasó de ${path} a ${moved.path}`);
        path = moved.path;
        this.config = { ...config, path };
        this.onPathMoved?.(path);
      }
    } catch (error) {
      this.log.warn(`Báscula: no se pudieron listar los puertos (${error.message})`);
    }

    const port = new this.SerialPort({
      path,
      baudRate: config.baudRate,
      dataBits: config.dataBits,
      parity: config.parity,
      stopBits: config.stopBits,
      autoOpen: false,
    });
    this.port = port;

    port.on('data', (chunk) => {
      if (generation === this.generation) this.#onData(chunk);
    });
    port.on('close', () => {
      if (generation !== this.generation) return;
      this.log.warn(`Báscula: se cerró el puerto ${path}`);
      this.#setReading(null);
      this.#setState('error', `Se desconectó la báscula (${path})`, path);
      this.#retry(generation);
    });
    port.on('error', (error) => {
      if (generation === this.generation) this.log.warn(`Báscula: ${error.message}`);
    });

    port.open((error) => {
      if (generation !== this.generation) {
        if (!error) port.close(() => {});
        return;
      }
      if (error) {
        this.port = null;
        this.#setState('error', `No se pudo abrir ${path}: ${friendlyOpenError(error)}`, path);
        this.#retry(generation);
        return;
      }
      this.log.info(
        `Báscula conectada en ${path} (${config.baudRate} baudios, modo ${config.mode})`,
      );
      this.lastFrameAt = this.now();
      this.#setState('waiting', 'Esperando datos de la báscula…', path);
      if (config.mode === 'request') this.#poll(generation, decodeCommand(config.command));
      this.#watchSilence(generation);
    });
  }

  #onData(chunk) {
    for (const frame of this.splitter.push(chunk)) {
      const parsed = parseWeightFrame(frame);
      if (!parsed) continue;
      const at = this.now();
      this.lastFrameAt = at;
      if (this.state.state !== 'connected') {
        this.#setState('connected', 'Báscula conectada', this.state.path);
      }
      const stable = this.stability.push(parsed.grams, at, parsed.stable);
      this.#setReading({ grams: parsed.grams, stable });
    }
  }

  /** Modo por petición: manda el comando (p. ej. "P") cada `intervalMs`. */
  #poll(generation, bytes) {
    const tick = () => {
      if (generation !== this.generation || !this.port?.isOpen) return;
      this.port.write(bytes);
      this.#later(generation, tick, this.config.intervalMs);
    };
    tick();
  }

  #watchSilence(generation) {
    const check = () => {
      if (generation !== this.generation) return;
      // #setState y #setReading ignoran repeticiones: no se emite nada mientras siga en silencio.
      if (this.now() - this.lastFrameAt > this.silenceMs) {
        this.#setReading(null);
        this.stability.reset();
        this.#setState(
          'waiting',
          'La báscula no envía datos: revisa que esté encendida y la velocidad del puerto',
          this.state.path,
        );
      }
      this.#later(generation, check, 500);
    };
    this.#later(generation, check, 500);
  }

  #retry(generation) {
    this.#later(generation, () => void this.#connect(generation), this.retryMs);
  }

  #later(generation, fn, ms) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (generation === this.generation) fn();
    }, ms);
    this.timers.add(timer);
  }

  #setState(state, message, path) {
    if (this.state.state === state && this.state.message === message && this.state.path === path) {
      return;
    }
    this.state = { state, message, path };
    this.emit('status', this.state);
  }

  #setReading(reading) {
    const same =
      reading === this.reading ||
      (reading &&
        this.reading &&
        reading.grams === this.reading.grams &&
        reading.stable === this.reading.stable);
    if (same) return;
    this.reading = reading ? { ...reading, at: this.now() } : null;
    this.emit('reading', this.reading);
  }
}

/** Mismo adaptador USB en otro COM: por número de serie, o por fabricante + modelo si es único. */
function findMovedPort(ports, match) {
  if (!match) return null;
  if (match.serialNumber) {
    const bySerial = ports.find((p) => p.serialNumber && p.serialNumber === match.serialNumber);
    if (bySerial) return bySerial;
  }
  if (match.vendorId && match.productId) {
    const candidates = ports.filter(
      (p) =>
        p.vendorId?.toLowerCase() === match.vendorId.toLowerCase() &&
        p.productId?.toLowerCase() === match.productId.toLowerCase(),
    );
    if (candidates.length === 1) return candidates[0];
  }
  return null;
}

function friendlyOpenError(error) {
  const text = String(error?.message ?? error);
  if (/access denied|acceso denegado|EBUSY|resource busy/i.test(text)) {
    return 'el puerto está en uso por otro programa';
  }
  if (/file not found|cannot find|ENOENT/i.test(text)) return 'el puerto no existe';
  return text;
}

module.exports = { ScaleService, findMovedPort };
