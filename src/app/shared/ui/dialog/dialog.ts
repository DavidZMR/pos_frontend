import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject, input } from '@angular/core';
import { PosButton } from '../button/button';
import { uniqueId } from '../field/field-state';

/**
 * Estructura visual de un diálogo abierto con `DialogService.open()`:
 *   <pos-dialog heading="Nuevo usuario" description="…">
 *     …contenido…
 *     <ng-container dialogActions>
 *       <button posButton variant="secondary" (click)="close()">Cancelar</button>
 *       <button posButton type="submit">Guardar</button>
 *     </ng-container>
 *   </pos-dialog>
 */
@Component({
  selector: 'pos-dialog',
  imports: [PosButton],
  template: `
    <header class="head">
      <div class="text">
        <h2 class="title" [id]="titleId">{{ heading() }}</h2>
        @if (description()) {
          <p class="description">{{ description() }}</p>
        }
      </div>
      @if (dialogRef && closable()) {
        <button
          posButton
          variant="ghost"
          size="sm"
          icon="x"
          iconOnly
          aria-label="Cerrar"
          (click)="dialogRef.close()"
        ></button>
      }
    </header>
    <div class="body"><ng-content /></div>
    <footer class="foot"><ng-content select="[dialogActions]" /></footer>
  `,
  host: { role: 'document', '[attr.aria-labelledby]': 'titleId' },
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-height: inherit;
      min-height: 0;
    }
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-5) var(--space-6) var(--space-4);
    }
    .text {
      display: grid;
      gap: var(--space-1);
    }
    .title {
      font-size: var(--text-xl);
      font-weight: 700;
    }
    .description {
      font-size: var(--text-sm);
      color: var(--ink-muted);
    }
    .body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--space-2) var(--space-6) var(--space-5);
    }
    .foot {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      padding: var(--space-4) var(--space-6);
      background: var(--surface-sunken);
      border-top: var(--border);
    }
    .foot:empty {
      display: none;
    }
  `,
})
export class PosDialog {
  readonly heading = input.required<string>();
  readonly description = input('');
  readonly closable = input(true);

  protected readonly dialogRef = inject(DialogRef, { optional: true });
  protected readonly titleId = uniqueId('pos-dialog-title');
}
