/**
 * RFC mexicano: 3 letras (persona moral) o 4 (física) + fecha AAMMDD + homoclave de 3.
 * Mismo criterio que el backend (business.schemas.ts). Vacío = sin RFC (válido).
 */
const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i;

export const RFC_MESSAGE = 'RFC inválido (12 o 13 caracteres, p. ej. ABC010101XY1)';

export function isValidRfc(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || RFC.test(trimmed);
}
