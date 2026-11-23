const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { detectScale } = require('./detect.cjs');
const {
  FakeScalePort,
  createPorts,
  openPort,
  reset,
  responders,
  until,
} = require('./test-ports.cjs');

afterEach(reset);

const fast = { listenMs: 40, answerMs: 40 };

test('sin puertos COM avisa que conecte la báscula', async () => {
  const messages = [];
  const found = await detectScale({
    SerialPort: FakeScalePort,
    onProgress: (m) => messages.push(m),
    ...fast,
  });
  assert.equal(found, null);
  assert.match(messages.at(-1), /No hay puertos COM/);
});

test('encuentra una báscula que responde a "P" y guarda cómo reconocer el adaptador', async () => {
  createPorts({ path: 'COM1' }, { path: 'COM4', vendorId: '1A86', productId: '7523' });
  responders.set('COM4', (written) => (written === 'P' ? '  1.250 kg\r\n' : null));
  const found = await detectScale({ SerialPort: FakeScalePort, ...fast });
  assert.equal(found.path, 'COM4');
  assert.equal(found.mode, 'request');
  assert.equal(found.command, 'P');
  assert.equal(found.baudRate, 9600);
  assert.equal(found.sampleGrams, 1250);
  assert.equal(found.match.vendorId, '1A86');
});

test('reconoce el comando ENQ (CAS/Rhino)', async () => {
  createPorts({ path: 'COM2' });
  responders.set('COM2', (written) => (written === '\u0005' ? 'ST,GS,+  0.500kg\r\n' : null));
  const found = await detectScale({ SerialPort: FakeScalePort, ...fast });
  assert.equal(found.command, '\\x05');
});

test('báscula en modo continuo: la detecta solo escuchando', async () => {
  createPorts({ path: 'COM3' });
  const promise = detectScale({ SerialPort: FakeScalePort, listenMs: 300, answerMs: 40 });
  await until(() => openPort('COM3'));
  openPort('COM3').port.emitData(Buffer.from('  0.300 kg\r\n'));
  const found = await promise;
  assert.equal(found.mode, 'continuous');
  assert.equal(found.sampleGrams, 300);
});

test('ningún puerto contesta: null y mensaje claro', async () => {
  createPorts({ path: 'COM1' });
  const messages = [];
  const found = await detectScale({
    SerialPort: FakeScalePort,
    onProgress: (m) => messages.push(m),
    ...fast,
  });
  assert.equal(found, null);
  assert.match(messages.at(-1), /No se encontró una báscula/);
});
