const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPrintQueue } = require('./print-queue.cjs');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('imprime un ticket a la vez, en orden', async () => {
  const enqueue = createPrintQueue();
  const log = [];
  const job = (name, ms) => async () => {
    log.push(`inicia ${name}`);
    await wait(ms);
    log.push(`termina ${name}`);
    return name;
  };
  const results = await Promise.all([
    enqueue(job('A', 30)),
    enqueue(job('B', 5)),
    enqueue(job('C', 1)),
  ]);
  assert.deepEqual(results, ['A', 'B', 'C']);
  assert.deepEqual(log, [
    'inicia A',
    'termina A',
    'inicia B',
    'termina B',
    'inicia C',
    'termina C',
  ]);
});

test('un trabajo que falla no detiene la cola', async () => {
  const enqueue = createPrintQueue();
  const failed = enqueue(async () => {
    throw new Error('sin papel');
  });
  const next = enqueue(async () => 'ok');
  await assert.rejects(failed, /sin papel/);
  assert.equal(await next, 'ok');
});
