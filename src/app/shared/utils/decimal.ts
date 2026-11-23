/**
 * Convierte un texto decimal ("1,234.50", "$12.5", "0.250") a entero escalado
 * (p. ej. decimals=2 → centavos) sin pasar por punto flotante.
 */
export function parseDecimalToInteger(input: string, decimals: number): number {
  const cleaned = input.trim().replace(/[\s,$]/g, '');
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
