/** Minúsculas, sin acentos y con espacios colapsados: "  Camarón  GRANDE " → "camaron grande". */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Escapa un texto para usarlo literal dentro de una RegExp. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** RegExp "contiene" segura a partir de texto del usuario, sobre el campo normalizado. */
export function containsRegex(search: string): RegExp {
  return new RegExp(escapeRegex(normalizeText(search)));
}
