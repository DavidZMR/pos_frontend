const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { ScaleService, findMovedPort } = require('./scale-service.cjs');
const {
  FakeScalePort,
  createPorts,
  openPort,
  reset,
  responders,
  silentLog,
  until,
  wait,
} = require('./test-ports.cjs');

const BASE = {
  enabled: true,
  path: 'COM3',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  mode: 'continuous',
  command: 'P',
  intervalMs: 30,
};

let service;
afterEach(() => {
  service?.stop();
  reset();
});

function start(config = BASE, extra = {}) {
  service = new ScaleService({
    SerialPort: FakeScalePort,
    log: silentLog,
    retryMs: 50,
    silenceMs: 150,
    ...extra,
  });
  const events = { status: [], reading: [] };
  service.on('status', (s) => events.status.push(s.state));
  service.on('reading', (r) => events.reading.push(r));
  service.configure(config);
  return events;
}

test('sin báscula configurada queda deshabilitada (captura manual)', () => {
  start({ ...BASE, enabled: false });
  assert.equal(service.snapshot().status.state, 'disabled');
});

test('modo continuo: lee pesos y marca estable cuando la báscula lo dice', async () => {
  createPorts({ path: 'COM3' });
  const events = start();
  await until(() => service.snapshot().status.state === 'waiting');

  const port = openPort('COM3');
  port.port.emitData(Buffer.from('US,GS,+  1.200kg\r\n'));
  await until(() => service.snapshot().reading?.grams === 1200);
  assert.equal(service.snapshot().reading.stable, false);
  assert.equal(service.snapshot().status.state, 'connected');

  port.port.emitData(Buffer.from('ST,GS,+  1.250kg\r\n'));
  await until(() => service.snapshot().reading?.stable === true);
  assert.equal(service.snapshot().reading.grams, 1250);

  // Repetir la misma lectura no genera eventos nuevos.
  const count = events.reading.length;
  port.port.emitData(Buffer.from('ST,GS,+  1.250kg\r\n'));
  await wait(30);
  assert.equal(events.reading.length, count);
});

test('modo por petición: manda el comando y lee la respuesta', async () => {
  createPorts({ path: 'COM3' });
  responders.set('COM3', (written) => (written === 'P' ? '  0.785 kg\r\n' : null));
  start({ ...BASE, mode: 'request' });
  await until(() => service.snapshot().reading?.grams === 785);
  // Sin bandera de estabilidad: estable al mantenerse 500 ms.
  await until(() => service.snapshot().reading?.stable === true, 2000);
});

test('si la báscula deja de mandar datos, avisa y borra la lectura', async () => {
  createPorts({ path: 'COM3' });
  start();
  await until(() => service.snapshot().status.state === 'waiting');
  openPort('COM3').port.emitData(Buffer.from('  2.000 kg\r\n'));
  await until(() => service.snapshot().status.state === 'connected');
  await until(() => service.snapshot().status.state === 'waiting', 1000);
  assert.equal(service.snapshot().reading, null);
  assert.match(service.snapshot().status.message, /no envía datos/);
});

test('puerto inexistente: error y reintenta solo hasta que aparece', async () => {
  const events = start();
  await until(() => service.snapshot().status.state === 'error');
  assert.match(service.snapshot().status.message, /No se encontró la báscula en COM3/);
  createPorts({ path: 'COM3' });
  await until(() => service.snapshot().status.state === 'waiting', 1000);
  assert.ok(events.status.includes('error'));
});

test('al desconectar el cable se reconecta sola', async () => {
  createPorts({ path: 'COM3' });
  start();
  await until(() => service.snapshot().status.state === 'waiting');
  const first = openPort('COM3');
  await new Promise((resolve) => first.close(resolve));
  await until(() => service.snapshot().status.state === 'error');
  await until(() => openPort('COM3') && openPort('COM3') !== first, 1000);
  assert.equal(service.snapshot().status.state, 'waiting');
});

test('si Windows le cambia el COM al adaptador USB, lo sigue y avisa el nuevo puerto', async () => {
  createPorts({ path: 'COM7', vendorId: '1A86', productId: '7523' });
  let moved = '';
  start(
    { ...BASE, path: 'COM3', match: { vendorId: '1a86', productId: '7523' } },
    { onPathMoved: (path) => (moved = path) },
  );
  await until(() => service.snapshot().status.state === 'waiting');
  assert.equal(moved, 'COM7');
  assert.equal(service.snapshot().status.path, 'COM7');
});

test('findMovedPort: por número de serie, o por fabricante+modelo solo si es único', () => {
  const ports = [
    { path: 'COM4', serialNumber: 'A1', vendorId: '0403', productId: '6001' },
    { path: 'COM5', serialNumber: 'B2', vendorId: '0403', productId: '6001' },
  ];
  assert.equal(findMovedPort(ports, { serialNumber: 'B2' }).path, 'COM5');
  assert.equal(findMovedPort(ports, { vendorId: '0403', productId: '6001' }), null);
  assert.equal(findMovedPort(ports, null), null);
});

test('stop() libera el puerto (para poder buscar básculas)', async () => {
  createPorts({ path: 'COM3' });
  start();
  await until(() => service.snapshot().status.state === 'waiting');
  const port = openPort('COM3');
  service.stop();
  await until(() => !port.isOpen);
});
