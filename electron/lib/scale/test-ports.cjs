// Doble de prueba (solo para tests): báscula falsa sobre SerialPortMock de serialport.
const { SerialPortMock } = require('serialport');

const binding = SerialPortMock.binding;

/** Respuestas por puerto: path → (bytesEscritos: string) => trama a contestar | null. */
const responders = new Map();

class FakeScalePort extends SerialPortMock {
  write(data, ...rest) {
    const result = super.write(data, ...rest);
    const respond = responders.get(this.path);
    const answer = respond?.(Buffer.from(data).toString('latin1'));
    if (answer) setTimeout(() => this.port?.emitData(Buffer.from(answer, 'latin1')), 5);
    return result;
  }
}

/** Puertos abiertos por el código bajo prueba, para emitir tramas como lo haría la báscula. */
const opened = [];
const originalOpen = FakeScalePort.prototype.open;
FakeScalePort.prototype.open = function open(callback) {
  opened.push(this);
  return originalOpen.call(this, callback);
};

function createPorts(...ports) {
  for (const port of ports) {
    binding.createPort(port.path, { readyData: Buffer.alloc(0), ...port });
  }
}

function reset() {
  binding.reset();
  responders.clear();
  opened.length = 0;
}

/** Último puerto abierto en `path` (ya abierto). */
function openPort(path) {
  return [...opened].reverse().find((p) => p.path === path && p.isOpen);
}

const silentLog = { info() {}, warn() {}, error() {} };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Espera a que `predicate()` sea verdadero (o falla tras `timeoutMs`). */
async function until(predicate, timeoutMs = 2000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Tiempo de espera agotado');
    await wait(10);
  }
}

module.exports = {
  FakeScalePort,
  createPorts,
  openPort,
  reset,
  responders,
  silentLog,
  until,
  wait,
};
