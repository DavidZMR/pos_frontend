import { formatMoney } from '../utils/format';

/** Formatos para gráficas y reportes (solo pantalla). */

const compactMoney = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const compactNumber = new Intl.NumberFormat('es-MX', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('es-MX', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 1234567 centavos → "$12.3 mil" (ejes y cifras grandes). Menos de $10,000: completo. */
export function formatMoneyCompact(cents: number): string {
  if (Math.abs(cents) < 1_000_000) return formatMoney(cents).replace(/\.00$/, '');
  return compactMoney.format(cents / 100);
}

/** Conteo completo: 14 623 → "14,623" (KPIs, tablas y textos: nunca abreviado). */
export function formatCount(value: number): string {
  return integer.format(value);
}

/** Conteo para ejes: completo hasta 9,999; después "14.6 k". */
export function formatCountCompact(value: number): string {
  return Math.abs(value) < 10_000 ? integer.format(value) : compactNumber.format(value);
}

/** "1 ticket", "2 tickets" (con el número completo). */
export function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

/** Puntos base → "38.3 %". */
export function formatBp(bp: number): string {
  return percent.format(bp / 10_000);
}

/** Cambio relativo entre dos cifras, en puntos base (null si no hay base para comparar). */
export function deltaBp(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) * 10_000) / Math.abs(previous));
}
