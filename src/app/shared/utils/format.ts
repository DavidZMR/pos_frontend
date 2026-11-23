import { UNITS, type Unit, qtyBaseToDecimalString } from './qty';

/** Formateo para pantalla (solo frontend). Los cálculos viven en money.ts / qty.ts. */

const LOCALE = 'es-MX';

const moneyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** 123450 → "$1,234.50". El entero se divide una sola vez, solo para mostrar. */
export function formatMoney(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—';
  return moneyFormatter.format(cents / 100);
}

/** 1250 g en kg → "1.250 kg"; 3 pz → "3 pz". */
export function formatQty(qtyBase: number | null | undefined, unit: Unit): string {
  if (qtyBase == null || !Number.isFinite(qtyBase)) return '—';
  return `${qtyBaseToDecimalString(qtyBase, unit)} ${UNITS[unit].label}`;
}

export function formatDate(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}
