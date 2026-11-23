import { Directive, TemplateRef, inject, input } from '@angular/core';

export interface PosCellContext<T> {
  $implicit: T;
  index: number;
}

/**
 * Plantilla personalizada para una columna de `pos-table`. Pasa las filas en `posCellOf`
 * para que `let-row` quede tipado:
 *   <ng-template posCell="status" [posCellOf]="users()" let-user>
 *     <pos-badge [tone]="user.active ? 'success' : 'neutral'">…</pos-badge>
 *   </ng-template>
 */
@Directive({ selector: 'ng-template[posCell]' })
export class PosCellDef<T> {
  readonly posCell = input.required<string>();
  readonly posCellOf = input<readonly T[]>();
  readonly template = inject<TemplateRef<PosCellContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(_dir: PosCellDef<T>, ctx: unknown): ctx is PosCellContext<T> {
    return true;
  }
}
