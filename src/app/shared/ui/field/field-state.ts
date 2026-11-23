import { Directive, computed, input, output, type Signal } from '@angular/core';
import type { ValidationError } from '@angular/forms/signals';

let nextId = 0;

/** Identificador único estable para enlazar label/ayuda/error con el control. */
export function uniqueId(prefix: string): string {
  return `${prefix}-${++nextId}`;
}

/**
 * Entradas comunes que el directivo `[formField]` de Signal Forms enlaza automáticamente
 * (errors, disabled, readonly, required, touched, invalid, name) más el output `touch`.
 */
@Directive()
export abstract class PosFieldBase {
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly required = input(false);
  readonly touched = input(false);
  readonly invalid = input(false);
  readonly name = input('');
  readonly touch = output<void>();

  /** Texto visible del campo. */
  readonly label = input('');
  readonly hint = input('');

  protected readonly controlId = uniqueId('pos-field');
  protected readonly hintId = `${this.controlId}-hint`;
  protected readonly errorId = `${this.controlId}-error`;

  /** Los errores solo se muestran después de que el usuario tocó el campo (o al enviar). */
  protected readonly showErrors: Signal<boolean> = computed(
    () => this.touched() && this.errors().length > 0,
  );
  protected readonly firstError = computed(() => this.errors()[0]?.message ?? 'Valor inválido');
  protected readonly describedBy = computed(() => {
    if (this.showErrors()) return this.errorId;
    return this.hint() ? this.hintId : null;
  });
}
