import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form, min, submit } from '@angular/forms/signals';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { PosButton, PosDialog, PosIcon, PosQtyInput } from '../../shared/ui';
import { lineTotalCents } from '../../shared/utils/money';
import { UNITS, unitScale } from '../../shared/utils/qty';
import type { PosProduct } from './pos-models';

export interface QtyDialogData {
  product: PosProduct;
  /** Cantidad inicial (al editar un renglón). */
  qtyBase?: number;
}

export interface QtyDialogResult {
  qtyBase: number;
  weighed: boolean;
}

/**
 * Captura de cantidad / peso. Para kg y l es donde se conectará la báscula (Fase 5);
 * mientras tanto el cajero teclea el peso.
 */
@Component({
  selector: 'pos-qty-dialog',
  imports: [FormField, PosDialog, PosQtyInput, PosButton, PosIcon, MoneyPipe],
  template: `
    <form novalidate (submit)="confirm(); $event.preventDefault()">
      <pos-dialog
        [heading]="data.product.name"
        [description]="(data.product.salePriceCents | money) + ' por ' + unitLabel"
      >
        <div class="body">
          <pos-qty-input
            #qty
            [label]="isWeight ? 'Peso' : 'Cantidad'"
            [unit]="data.product.unit"
            [formField]="qtyForm.qtyBase"
          />
          @if (isWeight) {
            <p class="scale-note">
              <pos-icon name="scale" [size]="16" />
              Báscula no conectada: escribe el peso que marca.
            </p>
          }
          <div class="total">
            <span>Importe</span>
            <strong class="num">{{ total() | money }}</strong>
          </div>
        </div>
        <ng-container dialogActions>
          <button posButton variant="secondary" type="button" (click)="ref.close()">
            Cancelar
          </button>
          <button posButton type="submit" icon="check">
            {{ data.qtyBase ? 'Cambiar' : 'Agregar' }}
          </button>
        </ng-container>
      </pos-dialog>
    </form>
  `,
  styles: `
    form {
      display: contents;
    }
    .body {
      display: grid;
      gap: var(--space-4);
    }
    .scale-note {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xs);
      color: var(--ink-muted);
    }
    .total {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius);
      background: var(--surface-sunken);
      color: var(--ink-muted);
      strong {
        font-family: var(--font-display);
        font-stretch: var(--display-stretch);
        font-size: var(--text-3xl);
        color: var(--ink);
      }
    }
  `,
})
export class QtyDialog {
  protected readonly ref = inject<DialogRef<QtyDialogResult>>(DialogRef);
  protected readonly data = inject<QtyDialogData>(DIALOG_DATA);
  protected readonly isWeight = this.data.product.unit !== 'pz';
  protected readonly unitLabel = UNITS[this.data.product.unit].label;

  private readonly qtyInput = viewChild.required<PosQtyInput>('qty');

  protected readonly model = signal({ qtyBase: this.data.qtyBase ?? 0 });
  protected readonly qtyForm = form(this.model, (s) => {
    min(s.qtyBase, 1, { message: this.isWeight ? 'Escribe el peso' : 'Escribe la cantidad' });
  });

  protected readonly total = computed(() =>
    lineTotalCents(
      this.data.product.salePriceCents,
      this.model().qtyBase,
      unitScale(this.data.product.unit),
    ),
  );

  constructor() {
    afterNextRender(() => this.qtyInput().focus(), { injector: inject(Injector) });
  }

  protected confirm(): void {
    void submit(this.qtyForm, async () => {
      this.ref.close({ qtyBase: this.model().qtyBase, weighed: false });
      return undefined;
    });
  }
}
