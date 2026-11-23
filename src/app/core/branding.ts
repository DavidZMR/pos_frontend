/**
 * Marca que ve el usuario (menú, inicio de sesión, títulos). El sistema es genérico: para otro
 * cliente basta cambiar estos valores y los de `electron/branding.cjs` (ventana, instalador).
 * El nombre de cada negocio (barra superior, tickets) es dato: se edita en Negocios o en Equipo.
 */
export const BRAND = {
  name: 'El Atlántico',
  /** Wordmark en dos pesos: "El" ligero + "Atlántico" negrita. */
  lead: 'El',
  strong: 'Atlántico',
} as const;
