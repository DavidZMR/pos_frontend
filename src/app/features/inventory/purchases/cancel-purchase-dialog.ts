import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { toApiError } from '../../../core/api/api-types';
import { PosButton, PosDialog, PosTextarea, ToastService } from '../../../shared/ui';
import { InventoryApi } from '../inventory-api';
import { type Purchase, purchaseFolio } from '../inventory-models';

@Component({
  selector: 'pos-cancel-purchase-dialog',
  imports: [FormField, PosDialog, PosTextarea, PosButton],
  template: `
    <form novalidate (submit)="cancel(); $event.preventDefault()">
      <pos-dialog
        [heading]="'Cancelar entrada ' + folio"
        description="Se resta de la existencia lo que entró. El costo promedio y los precios no se revierten."
      >
        <pos-textarea
          label="Motivo"
          placeholder="p. ej. Se capturó dos veces"
          [rows]="3"
          [formField]="cancelForm.reason"
        />
        <ng-container dialogActions>
          <button posButton variant="secondary" type="button" (click)="ref.close()">Volver</button>
          <button posButton variant="danger" type="submit" icon="x" [loading]="saving()">
            Cancelar entrada
          </button>
        </ng-container>
      </pos-dialog>
    </form>
  `,
  styles: `
    form {
      display: contents;
    }
  `,
})
export class CancelPurchaseDialog {
  protected readonly ref = inject<DialogRef<Purchase>>(DialogRef);
  private readonly purchase = inject<Purchase>(DIALOG_DATA);
  private readonly api = inject(InventoryApi);
  private readonly toast = inject(ToastService);

  protected readonly folio = purchaseFolio(this.purchase.folio);
  protected readonly saving = signal(false);
  protected readonly model = signal({ reason: '' });
  protected readonly cancelForm = form(this.model, (s) => {
    required(s.reason, { message: 'Escribe el motivo' });
    minLength(s.reason, 3, { message: 'Mínimo 3 caracteres' });
    maxLength(s.reason, 200, { message: 'Máximo 200 caracteres' });
  });

  protected cancel(): void {
    void submit(this.cancelForm, async () => {
      this.saving.set(true);
      try {
        const updated = await this.api.cancelPurchase(this.purchase.id, this.model().reason.trim());
        this.toast.success(`Entrada ${this.folio} cancelada`);
        this.ref.close(updated);
      } catch (error) {
        this.toast.error(toApiError(error).message);
      } finally {
        this.saving.set(false);
      }
      return undefined;
    });
  }
}
