import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import {
  FormField,
  form,
  maxLength,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { toApiError } from '../../../core/api/api-types';
import { serverFieldErrors } from '../../../core/api/server-errors';
import { PosButton, PosDialog, PosInput, PosMoneyInput, ToastService } from '../../../shared/ui';
import { formatMoney } from '../../../shared/utils/format';
import { CashSessionStore } from '../cash-session-store';
import type { CashSession } from '../pos-models';

export interface CashMovementDialogData {
  type: 'in' | 'out';
  /** Efectivo en caja al abrir el diálogo (límite de un retiro). */
  cashOnHandCents: number;
}

/** Entrada o retiro de efectivo del turno abierto (cambio, pago a proveedor, depósito…). */
@Component({
  selector: 'pos-cash-movement-dialog',
  imports: [FormField, PosDialog, PosButton, PosInput, PosMoneyInput],
  template: `
    <form novalidate (submit)="save(); $event.preventDefault()">
      <pos-dialog
        [heading]="isOut ? 'Retiro de efectivo' : 'Entrada de efectivo'"
        [description]="help"
      >
        <div class="fields">
          <pos-money-input
            label="Monto"
            [hint]="isOut ? 'En caja: ' + onHand : ''"
            [formField]="movementForm.amountCents"
          />
          <pos-input
            label="Motivo"
            [placeholder]="isOut ? 'p. ej. Pago de hielo al proveedor' : 'p. ej. Cambio adicional'"
            [formField]="movementForm.reason"
          />
        </div>
        <ng-container dialogActions>
          <button posButton variant="secondary" (click)="ref.close()">Cancelar</button>
          <button
            posButton
            type="submit"
            [icon]="isOut ? 'arrow-up' : 'arrow-down'"
            [loading]="saving()"
          >
            {{ isOut ? 'Registrar retiro' : 'Registrar entrada' }}
          </button>
        </ng-container>
      </pos-dialog>
    </form>
  `,
  styles: `
    .fields {
      display: grid;
      gap: var(--space-4);
    }
  `,
})
export class CashMovementDialog {
  protected readonly ref = inject<DialogRef<CashSession>>(DialogRef);
  private readonly data = inject<CashMovementDialogData>(DIALOG_DATA);
  private readonly store = inject(CashSessionStore);
  private readonly toast = inject(ToastService);

  protected readonly isOut = this.data.type === 'out';
  protected readonly onHand = formatMoney(this.data.cashOnHandCents);
  protected readonly help = this.isOut
    ? 'Sale dinero de la caja. Se resta del efectivo esperado en el corte.'
    : 'Entra dinero a la caja sin ser venta. Se suma al efectivo esperado en el corte.';
  protected readonly saving = signal(false);

  protected readonly model = signal({ amountCents: 0, reason: '' });
  protected readonly movementForm = form(this.model, (s) => {
    validate(s.amountCents, ({ value }) => {
      if (value() <= 0) return { kind: 'min', message: 'Escribe el monto' };
      if (this.isOut && value() > this.data.cashOnHandCents) {
        return { kind: 'max', message: `No hay tanto efectivo en caja (${this.onHand})` };
      }
      return undefined;
    });
    required(s.reason, { message: 'Escribe el motivo' });
    minLength(s.reason, 3, { message: 'Mínimo 3 caracteres' });
    maxLength(s.reason, 200, { message: 'Máximo 200 caracteres' });
  });

  protected save(): void {
    void submit(this.movementForm, async (f) => {
      this.saving.set(true);
      try {
        const { amountCents, reason } = this.model();
        const session = await this.store.addMovement({
          type: this.data.type,
          amountCents,
          reason: reason.trim(),
        });
        this.toast.success(
          `${this.isOut ? 'Retiro' : 'Entrada'} de ${formatMoney(amountCents)} registrado`,
        );
        this.ref.close(session);
        return undefined;
      } catch (error) {
        const apiError = toApiError(error);
        const errors = serverFieldErrors(apiError, {
          amountCents: f.amountCents,
          reason: f.reason,
        });
        if (!errors.length) this.toast.error(apiError.message);
        return errors;
      } finally {
        this.saving.set(false);
      }
    });
  }
}
