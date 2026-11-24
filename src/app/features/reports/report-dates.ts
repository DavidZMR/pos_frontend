/**
 * Fechas de calendario para los reportes, en la ZONA DEL NEGOCIO (no la de la PC).
 * Todo es texto `YYYY-MM-DD`: así "hoy" en Puerto Vallarta no depende del reloj de quien mira.
 */

export type PresetId =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'last12m'
  | 'custom';

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: 'last7', label: 'Últimos 7 días' },
  { id: 'last30', label: 'Últimos 30 días' },
  { id: 'thisMonth', label: 'Este mes' },
  { id: 'lastMonth', label: 'Mes pasado' },
  { id: 'thisYear', label: 'Este año' },
  { id: 'last12m', label: 'Últimos 12 meses' },
  { id: 'custom', label: 'Personalizado' },
];

/** Fecha de calendario de un instante en una zona horaria. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function monthStart(date: string, monthsBack = 0): string {
  const [y, m] = date.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 - monthsBack, 1)).toISOString().slice(0, 10);
}

/** Rango [from, to] de un preset (ambos incluidos). */
export function presetRange(
  preset: Exclude<PresetId, 'custom'>,
  today: string,
): { from: string; to: string } {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case 'last7':
      return { from: addDays(today, -6), to: today };
    case 'last30':
      return { from: addDays(today, -29), to: today };
    case 'thisMonth':
      return { from: monthStart(today), to: today };
    case 'lastMonth':
      return { from: monthStart(today, 1), to: addDays(monthStart(today), -1) };
    case 'thisYear':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'last12m':
      return { from: monthStart(today, 11), to: today };
  }
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Etiqueta corta de un periodo para ejes y tablas: "3 nov", "sem. 3 nov", "nov 2026", "2026". */
export function periodLabel(
  period: string,
  granularity: 'day' | 'week' | 'month' | 'year',
): string {
  const [y, m, d] = period.split('-').map(Number) as [number, number, number];
  const month = MONTHS[m - 1];
  switch (granularity) {
    case 'day':
      return `${d} ${month}`;
    case 'week':
      return `sem. ${d} ${month}`;
    case 'month':
      return `${month} ${y}`;
    case 'year':
      return String(y);
  }
}

/** "1 – 23 nov 2026" / "3 nov 2026" / "15 dic 2025 – 23 nov 2026". */
export function rangeLabel(from: string, to: string): string {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  const end = `${td} ${MONTHS[tm - 1]} ${ty}`;
  if (from === to) return end;
  if (fy === ty && fm === tm) return `${fd} – ${end}`;
  if (fy === ty) return `${fd} ${MONTHS[fm - 1]} – ${end}`;
  return `${fd} ${MONTHS[fm - 1]} ${fy} – ${end}`;
}
