import type { FieldTree, ValidationError } from '@angular/forms/signals';
import type { ApiError } from './api-types';

type FieldTrees = Record<string, FieldTree<unknown> | undefined>;

/**
 * Traduce los errores de validación del backend a errores de Signal Forms sobre cada campo,
 * para devolverlos desde la acción de `submit()`. Los campos que no estén en `fields`
 * se ignoran (el mensaje general se muestra aparte).
 *
 *   return serverFieldErrors(error, { username: userForm.username });
 */
export function serverFieldErrors(
  error: ApiError,
  fields: FieldTrees,
  /** Asigna un error sin detalle de campo (p. ej. 409 de duplicado) a un campo concreto. */
  fallbackField?: string,
): ValidationError.WithOptionalFieldTree[] {
  const errors: ValidationError.WithOptionalFieldTree[] = [];
  for (const [name, messages] of Object.entries(error.fieldErrors)) {
    const fieldTree = fields[name];
    const message = messages[0];
    if (fieldTree && message) errors.push({ kind: 'server', message, fieldTree });
  }
  if (errors.length === 0 && fallbackField && fields[fallbackField]) {
    errors.push({ kind: 'server', message: error.message, fieldTree: fields[fallbackField] });
  }
  return errors;
}
