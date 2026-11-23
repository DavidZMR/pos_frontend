import { Component, inject } from '@angular/core';
import { BusinessContext } from '../../../core/business/business-context';
import { PosEmptyState } from '../empty-state/empty-state';

/**
 * Envuelve pantallas que trabajan dentro de un negocio (catálogo, almacén, ventas).
 * Si el superadmin no ha elegido negocio, muestra cómo hacerlo en lugar del contenido.
 */
@Component({
  selector: 'pos-business-gate',
  imports: [PosEmptyState],
  template: `
    @if (context.scope()) {
      <ng-content />
    } @else {
      <div class="gate">
        <pos-empty-state
          icon="store"
          heading="Elige un negocio"
          message="Selecciona en la barra superior el negocio con el que quieres trabajar."
        />
      </div>
    }
  `,
  styles: `
    .gate {
      padding: var(--space-11) var(--space-4);
      background: var(--surface-raised);
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius-lg);
    }
  `,
})
export class PosBusinessGate {
  protected readonly context = inject(BusinessContext);
}
