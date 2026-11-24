/**
 * Convierte un texto decimal ("1,234.50", "$12.5", "0.250") a entero escalado
 * (p. ej. decimals=2 → centavos) sin pasar por punto flotante.
 *
 * La coma SOLO se acepta como separador de miles bien formado ("1,234.50"). "1,5" no es 1.5
 * ni 15: es un error (antes se descartaba la coma y "1,5 kg" se volvía 15 kg, diez veces más).
 * Con `grouping: false` (cantidades) cualquier coma es error: "1,250" kg sería ambiguo.
 */
export interface DecimalOptions {
  /** Permitir comas como separador de miles (dinero). Por defecto true. */
  grouping?: boolean;
}

const GROUPED_THOUSANDS = /^\d{1,3}(?:,\d{3})+$/;

export function parseDecimalToInteger(
  input: string,
  decimals: number,
  { grouping = true }: DecimalOptions = {},
): number {
  const trimmed = input.trim().replace(/[\s$]/g, '');
  const sign = trimmed.startsWith('-') ? '-' : '';
  const [intRaw = '', ...rest] = trimmed.slice(sign.length).split('.');
  if (intRaw.includes(',') && (!grouping || !GROUPED_THOUSANDS.test(intRaw))) {
    throw new RangeError(`Usa punto para los decimales: "${input}"`);
  }
  const cleaned = `${sign}${intRaw.replace(/,/g, '')}${rest.length ? `.${rest.join('.')}` : ''}`;
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(cleaned);
  const intPart = match?.[2] ?? '';
  const fracPart = match?.[3] ?? '';
  if (!match || (intPart === '' && fracPart === '')) {
    throw new RangeError(`Número inválido: "${input}"`);
  }
  if (fracPart.length > decimals) {
    throw new RangeError(`Máximo ${decimals} decimales: "${input}"`);
  }
  const scale = 10 ** decimals;
  const value = Number(intPart || '0') * scale + Number(fracPart.padEnd(decimals, '0') || '0');
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Número fuera de rango: "${input}"`);
  }
  return match[1] && value !== 0 ? -value : value;
}

/** Formatea un entero escalado como texto decimal fijo ("12345", 2 → "123.45"). */
export function formatIntegerAsDecimal(value: number, decimals: number): string {
  const negative = value < 0;
  const digits = Math.abs(Math.trunc(value))
    .toString()
    .padStart(decimals + 1, '0');
  const intPart = decimals > 0 ? digits.slice(0, -decimals) : digits;
  const fracPart = decimals > 0 ? `.${digits.slice(-decimals)}` : '';
  return `${negative ? '-' : ''}${intPart}${fracPart}`;
}
