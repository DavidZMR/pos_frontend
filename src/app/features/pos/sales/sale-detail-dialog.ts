import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { toApiError } from '../../../core/api/api-types';
import { AuthStore } from '../../../core/auth/auth-store';
import { PosButton, PosDialog, PosTextarea, ToastService } from '../../../shared/ui';
import { PosApi } from '../pos-api';
import { type Sale, saleFolio } from '../pos-models';
import { PosSaleTicket } from '../sale-ticket';
import { TicketPrinter } from '../ticket/ticket-printer';

/** Detalle de una venta; el admin puede cancelarla (regresa la mercancía al inventario). */
@Component({
  selector: 'pos-sale-detail-dialog',
  imports: [FormField, PosDialog, PosButton, PosTextarea, PosSaleTicket],
  template: `
    <pos-dialog [heading]="'Venta ' + folio" [description]="statusText()">
      @if (sale().status === 'cancelled') {
        <p class="cancelled" role="note">
          Cancelada por {{ sale().cancelledByName }}: “{{ sale().cancelReason }}”
        </p>
      }
      <pos-sale-ticket [sale]="sale()" />

      @if (cancelling()) {
        <form class="cancel-form" novalidate (submit)="confirmCancel(); $event.preventDefault()">
          <pos-textarea
            label="Motivo de la cancelación"
            placeholder="p. ej. El cliente devolvió el producto"
            [rows]="2"
            [formField]="cancelForm.reason"
          />
          <div class="cancel-actions">
            <button posButton variant="secondary" (click)="cancelling.set(false)">Volver</button>
            <button posButton variant="danger" type="submit" icon="x" [loading]="saving()">
              Cancelar venta
            </button>
          </div>
        </form>
      }

      <ng-container dialogActions>
        @if (tickets.ready() && !cancelling()) {
          <button
            posButton
            variant="secondary"
            icon="printer"
            [loading]="printing()"
            (click)="print()"
          >
            Reimprimir
          </button>
        }
        @if (canCancel() && !cancelling()) {
          <button posButton variant="danger" icon="x" (click)="cancelling.set(true)">
            Cancelar venta
          </button>
        }
        <button posButton variant="secondary" (click)="ref.close(changed)">Cerrar</button>
      </ng-container>
    </pos-dialog>
  `,
  styles: `
    .cancelled {
      margin-bottom: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius);
      background: var(--danger-soft);
      color: var(--danger-hover);
      font-size: var(--text-sm);
    }
    .cancel-form {
      display: grid;
      gap: var(--space-3);
      margin-top: var(--space-4);
      padding: var(--space-4);
      border: 1px solid var(--danger);
      border-radius: var(--radius);
      background: var(--danger-soft);
    }
    .cancel-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
  `,
})
export class SaleDetailDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly api = inject(PosApi);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);
  protected readonly tickets = inject(TicketPrinter);
  protected readonly printing = signal(false);

  protected readonly sale = signal(inject<Sale>(DIALOG_DATA));
  protected readonly folio = saleFolio(this.sale().folio);
  protected readonly cancelling = signal(false);
  protected readonly saving = signal(false);
  protected changed = false;

  protected readonly canCancel = computed(
    () => this.sale().status === 'completed' && this.auth.hasRole('admin', 'superadmin'),
  );
  protected readonly statusText = computed(() =>
    this.sale().status === 'completed' ? 'Venta vigente' : 'Venta cancelada',
  );

  protected readonly model = signal({ reason: '' });
  protected readonly cancelForm = form(this.model, (s) => {
    required(s.reason, { message: 'Escribe el motivo' });
    minLength(s.reason, 3, { message: 'Mínimo 3 caracteres' });
    maxLength(s.reason, 200, { message: 'Máximo 200 caracteres' });
  });

  protected async print(): Promise<void> {
    this.printing.set(true);
    try {
      await this.tickets.printSale(this.sale(), { reprint: true });
    } finally {
      this.printing.set(false);
    }
  }

  protected confirmCancel(): void {
    void submit(this.cancelForm, async () => {
      this.saving.set(true);
      try {
        const updated = await this.api.cancelSale(this.sale().id, this.model().reason.trim());
        this.sale.set(updated);
        this.changed = true;
        this.cancelling.set(false);
        this.toast.success(`Venta ${this.folio} cancelada; la mercancía regresó al inventario`);
      } catch (error) {
        this.toast.error(toApiError(error).message);
      } finally {
        this.saving.set(false);
      }
      return undefined;
    });
  }
}
