// Lectura de tramas de báscula (funciones puras, sin E/S; ver frames.test.cjs).
//
// Las básculas comerciales mandan texto por el puerto serial, p. ej.:
//   Torrey / Rhino ............ "  1.250 kg\r\n"            (al recibir "P" o continuo)
//   CAS / genéricas ........... "ST,GS,+  1.250kg\r\n"      (ST = estable, US = inestable)
//   Mettler Toledo (SICS) ..... "S S      1.250 kg\r\n"     (S S = estable, S D = en movimiento)
//   Ohaus ..................... "    1.250 kg ?\r\n"         (? = inestable)
// El peso se devuelve en GRAMOS ENTEROS (unidad base de kg en el POS), sin flotantes.

const TERMINATORS = /[\r\n\u0003]+/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: tramas seriales con STX/ETX
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const MAX_PENDING = 256;

/** Junta los bytes que llegan en pedazos y devuelve tramas completas (texto, sin controles). */
class FrameSplitter {
  #pending = '';

  /** @param {Buffer | string} chunk */
  push(chunk) {
    this.#pending += typeof chunk === 'string' ? chunk : chunk.toString('latin1');
    const parts = this.#pending.split(TERMINATORS);
    this.#pending = parts.pop() ?? '';
    // Una báscula que nunca manda fin de línea no debe crecer el búfer sin límite.
    if (this.#pending.length > MAX_PENDING) this.#pending = this.#pending.slice(-MAX_PENDING);
    return parts.map((part) => part.replace(CONTROL, '').trim()).filter(Boolean);
  }

  reset() {
    this.#pending = '';
  }
}

const WEIGHT = /([+-]?)\s*(\d+(?:[.,]\d+)?)\s*(kg|lb|oz|g)?(?![a-z])/gi;

/** "1.2505" con 3 decimales → 1251 (redondeo comercial sobre la cadena, sin flotantes). */
function decimalToInteger(text, decimals) {
  const [whole, fraction = ''] = text.replace(',', '.').split('.');
  const padded = `${fraction}${'0'.repeat(decimals)}`;
  let value = Number(whole) * 10 ** decimals + Number(padded.slice(0, decimals) || '0');
  if (Number(padded[decimals] ?? '0') >= 5) value += 1;
  return value;
}

/**
 * Peso de una trama, o null si no trae un peso (texto basura, sobrecarga "OL", etc.).
 * Sin unidad se asume kg.
 * @returns {{ grams: number, stable: boolean | null } | null}
 */
function parseWeightFrame(frame) {
  if (!frame || /\bO-?L\b|overload|sobrecarga/i.test(frame)) return null;

  const matches = [...frame.matchAll(WEIGHT)];
  if (!matches.length) return null;
  // Si la trama trae varios números (p. ej. peso, precio e importe) gana el que tiene unidad.
  const match = matches.find((m) => m[3]) ?? matches[0];
  const [, sign, number, rawUnit = 'kg'] = match;
  const unit = rawUnit.toLowerCase();

  let grams;
  if (unit === 'kg') grams = decimalToInteger(number, 3);
  else if (unit === 'g') grams = decimalToInteger(number, 0);
  // 1 lb = 453.59237 g ; 1 oz = 28.349523125 g. Se convierte desde milésimas con un solo redondeo.
  else if (unit === 'lb') grams = Math.round((decimalToInteger(number, 3) * 45359237) / 1e8);
  else grams = Math.round((decimalToInteger(number, 3) * 28349523125) / 1e12);
  if (sign === '-') grams = -grams;

  return { grams, stable: stabilityFlag(frame) };
}

/** true / false si la báscula lo indica en la trama; null si no lo dice. */
function stabilityFlag(frame) {
  if (/\bUS\b|\bMO\b|^S\s+D\b|\?/.test(frame)) return false;
  if (/\bST\b|^S\s+S\b/.test(frame)) return true;
  return null;
}

/**
 * Decide si el peso ya está estable. Si la báscula lo indica, se le cree; si no, el peso
 * se considera estable cuando se mantiene igual (± tolerancia) durante `holdMs`.
 */
class StabilityTracker {
  #value = null;
  #since = 0;

  constructor({ holdMs = 500, toleranceGrams = 0 } = {}) {
    this.holdMs = holdMs;
    this.toleranceGrams = toleranceGrams;
  }

  /** @returns {boolean} */
  push(grams, at, flag = null) {
    const changed = this.#value === null || Math.abs(grams - this.#value) > this.toleranceGrams;
    if (changed) {
      this.#value = grams;
      this.#since = at;
    }
    if (flag !== null) return flag;
    return !changed && at - this.#since >= this.holdMs;
  }

  reset() {
    this.#value = null;
    this.#since = 0;
  }
}

/** "P", "\\x05", "SI\\r\\n" (como se escribe en configuración) → bytes a enviar. */
function decodeCommand(text) {
  const decoded = String(text ?? '')
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
  return Buffer.from(decoded, 'latin1');
}

module.exports = { FrameSplitter, StabilityTracker, decodeCommand, parseWeightFrame };
