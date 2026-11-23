const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  FrameSplitter,
  StabilityTracker,
  decodeCommand,
  parseWeightFrame,
} = require('./frames.cjs');

test('tramas de distintas marcas → gramos enteros y estabilidad', () => {
  const cases = [
    ['  1.250 kg', { grams: 1250, stable: null }], // Torrey / Rhino
    ['ST,GS,+  1.250kg', { grams: 1250, stable: true }], // CAS
    ['US,GS,+  0.785kg', { grams: 785, stable: false }],
    ['S S      2.005 kg', { grams: 2005, stable: true }], // Mettler SICS
    ['S D      2.010 kg', { grams: 2010, stable: false }],
    ['    0.450 kg ?', { grams: 450, stable: false }], // Ohaus en movimiento
    ['001.500', { grams: 1500, stable: null }], // sin unidad: kg
    ['1,250 kg', { grams: 1250, stable: null }], // coma decimal
    ['750 g', { grams: 750, stable: null }],
    ['1.00 lb', { grams: 454, stable: null }], // 453.59 g
    ['ST,GS,-  0.020kg', { grams: -20, stable: true }], // tara negativa
    ['1.2505 kg', { grams: 1251, stable: null }], // 4 decimales: redondeo comercial
  ];
  for (const [frame, expected] of cases) {
    assert.deepEqual(parseWeightFrame(frame), expected, frame);
  }
});

test('con varios números gana el que trae unidad (básculas que calculan precio)', () => {
  assert.deepEqual(parseWeightFrame('01 1.250kg  $389.00  $486.25'), { grams: 1250, stable: null });
});

test('basura y sobrecarga no son pesos', () => {
  for (const frame of ['', 'READY', 'ST,GS,OL', 'OVERLOAD', '----']) {
    assert.equal(parseWeightFrame(frame), null, frame);
  }
});

test('el separador junta pedazos, quita STX/ETX y respeta CR, LF y ETX', () => {
  const splitter = new FrameSplitter();
  assert.deepEqual(splitter.push(Buffer.from('\u0002  1.2')), []);
  assert.deepEqual(splitter.push(Buffer.from('50 kg\r\n  1.25')), ['1.250 kg']);
  assert.deepEqual(splitter.push('5 kg\u0003'), ['1.255 kg']);
  assert.deepEqual(splitter.push('\r\n\r\n'), []);
});

test('el separador no crece sin límite si nunca llega fin de línea', () => {
  const splitter = new FrameSplitter();
  splitter.push('x'.repeat(10_000));
  assert.deepEqual(splitter.push('1.000 kg\n'), [`${'x'.repeat(256)}1.000 kg`]);
});

test('estable: se cree a la báscula; si no lo dice, mismo peso durante holdMs', () => {
  const tracker = new StabilityTracker({ holdMs: 500 });
  assert.equal(tracker.push(1000, 0), false);
  assert.equal(tracker.push(1000, 300), false);
  assert.equal(tracker.push(1000, 520), true);
  assert.equal(tracker.push(1005, 600), false); // cambió: vuelve a contar
  assert.equal(tracker.push(1005, 1100), true);
  assert.equal(tracker.push(1005, 1150, false), false); // la báscula dice "en movimiento"
  assert.equal(tracker.push(1300, 1200, true), true); // la báscula dice "estable"
});

test('tolerancia en gramos para básculas que oscilan', () => {
  const tracker = new StabilityTracker({ holdMs: 200, toleranceGrams: 2 });
  tracker.push(1000, 0);
  assert.equal(tracker.push(1002, 250), true);
});

test('comandos con escapes', () => {
  assert.deepEqual([...decodeCommand('P')], [0x50]);
  assert.deepEqual([...decodeCommand('\\x05')], [0x05]);
  assert.deepEqual([...decodeCommand('SI\\r\\n')], [0x53, 0x49, 0x0d, 0x0a]);
});
