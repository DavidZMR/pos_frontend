import { formatIntegerAsDecimal, parseDecimalToInteger } from './decimal.js';

/**
 * Reglas de dinero del POS (idénticas en pos_frontend/src/app/shared/utils/money.ts):
 * todo importe es un entero en centavos; solo se redondea en el total de cada línea.
 */

/** 1600 basis points = 16 % de IVA. */
export const BASIS_POINTS = 10_000;

export function isCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/** "$1,234.5" → 123450. Lanza RangeError si el texto no es válido o trae más de 2 decimales. */
export function parseMoneyToCents(input: string): number {
  return parseDecimalToInteger(input, 2);
}

/** 123450 → "1234.50" (sin símbolo ni separadores; para la UI usar el formateador local). */
export function centsToDecimalString(cents: number): string {
  return formatIntegerAsDecimal(cents, 2);
}

/** Total de una línea: precio por unidad de venta × cantidad en unidad base / escala. Único redondeo. */
export function lineTotalCents(unitPriceCents: number, qtyBase: number, unitScale: number): number {
  return Math.round((unitPriceCents * qtyBase) / unitScale);
}

/** IVA contenido en un importe que ya lo incluye. */
export function includedTaxCents(totalCents: number, taxRateBp: number): number {
  if (taxRateBp <= 0) return 0;
  return Math.round((totalCents * taxRateBp) / (BASIS_POINTS + taxRateBp));
}

/**
 * Costo promedio ponderado tras una entrada de mercancía.
 * Si el stock actual es ≤ 0 (p. ej. se vendió en negativo) toma el costo nuevo.
 */
export function weightedAverageCostCents(
  currentStock: number,
  currentCostCents: number,
  addedQty: number,
  addedCostCents: number,
): number {
  if (currentStock <= 0 || currentStock + addedQty <= 0) return addedCostCents;
  return Math.round(
    (currentStock * currentCostCents + addedQty * addedCostCents) / (currentStock + addedQty),
  );
}
