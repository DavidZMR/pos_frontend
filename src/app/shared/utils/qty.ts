import { formatIntegerAsDecimal, parseDecimalToInteger } from './decimal.js';

/**
 * Unidades de venta. La cantidad se guarda como entero en la unidad base:
 * pz → piezas, kg → gramos, l → mililitros. (Idéntico en pos_frontend.)
 */
export const UNITS = {
  pz: { scale: 1, decimals: 0, label: 'pz', baseLabel: 'pz' },
  kg: { scale: 1000, decimals: 3, label: 'kg', baseLabel: 'g' },
  l: { scale: 1000, decimals: 3, label: 'l', baseLabel: 'ml' },
} as const;

export type Unit = keyof typeof UNITS;
export const UNIT_CODES = Object.keys(UNITS) as Unit[];

export function unitScale(unit: Unit): number {
  return UNITS[unit].scale;
}

/** "1.25" kg → 1250 g; "3" pz → 3. Lanza RangeError si trae más decimales de los permitidos. */
export function parseQtyToBase(input: string, unit: Unit): number {
  return parseDecimalToInteger(input, UNITS[unit].decimals);
}

/** 1250 (kg) → "1.250"; 3 (pz) → "3". */
export function qtyBaseToDecimalString(qtyBase: number, unit: Unit): string {
  return formatIntegerAsDecimal(qtyBase, UNITS[unit].decimals);
}
