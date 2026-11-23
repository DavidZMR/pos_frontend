// Cola de impresión: un ticket a la vez (dos ventanas ocultas imprimiendo a la vez revuelven el
// papel). Si un trabajo falla, los siguientes se imprimen igual.
function createPrintQueue() {
  let tail = Promise.resolve();
  return (job) => {
    const run = tail.then(job, job);
    tail = run.catch(() => {});
    return run;
  };
}

module.exports = { createPrintQueue };
