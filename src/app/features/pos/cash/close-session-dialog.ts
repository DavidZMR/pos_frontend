import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, submit } from '@angular/forms/signals';
import { toApiError } from '../../../core/api/api-types';
import { serverFieldErrors } from '../../../core/api/server-errors';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import {
  PosBadge,
  PosButton,
  PosDialog,
  PosMoneyInput,
  PosTextarea,
  ToastService,
} from '../../../shared/ui';
import { formatMoney } from '../../../shared/utils/format';
import { CashSessionStore } from '../cash-session-store';
import { type CashSession, cashDifference, sessionFolio, sessionTotals } from '../pos-models';

/** Corte de caja: se cuenta el efectivo, se ve la diferencia contra lo esperado y se cierra el turno. */
@Component({
  selector: 'pos-close-session-dialog',
  imports: [FormField, MoneyPipe, PosBadge, PosButton, PosDialog, PosMoneyInput, PosTextarea],
  template: `
    <form novalidate (submit)="save(); $event.preventDefault()">
      <pos-dialog
        [heading]="'Corte de caja ' + folio"
        description="Cuenta el efectivo que hay en el cajón (billetes y monedas) y escríbelo."
      >
        <div class="layout">
          <dl class="expected">
            <div>
              <dt>Efectivo esperado</dt>
              <dd class="num">{{ expected | money }}</dd>
            </div>
            <p class="formula">
              Fondo {{ session.openingFloatCents | money }} + efectivo vendido
              {{ totals.byMethod.cash | money }} + entradas {{ totals.cashInCents | money }} −
              retiros {{ totals.cashOutCents | money }}
            </p>
          </dl>

          <pos-money-input label="Efectivo contado" [formField]="closeForm.countedCashCents" />

          <div class="result" [class]="'tone-' + difference().tone" aria-live="polite">
            <span class="result-label">
              Diferencia <pos-badge [tone]="difference().tone">{{ difference().label }}</pos-badge>
            </span>
            <span class="result-value num">{{ differenceCents() | money }}</span>
          </div>

          <pos-textarea
            label="Notas del corte (opcional)"
            placeholder="p. ej. Faltaron $20 de cambio a un cliente"
            [rows]="2"
            [formField]="closeForm.notes"
          />
        </div>

        <ng-container dialogActions>
          <button posButton variant="secondary" (click)="ref.close()">Seguir vendiendo</button>
          <button posButton type="submit" icon="lock" [loading]="saving()">Cerrar caja</button>
        </ng-container>
      </pos-dialog>
    </form>
  `,
  styles: `
    .layout {
      display: grid;
      gap: var(--space-4);
    }
    .expected {
      margin: 0;
      padding: var(--space-4);
      background: var(--surface-sunken);
      border: var(--border);
      border-radius: var(--radius);
    }
    .expected > div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .expected dt {
      font-weight: 600;
    }
    .expected dd {
      margin: 0;
      font-family: var(--font-display);
      font-stretch: var(--display-stretch);
      font-size: var(--text-2xl);
      font-weight: 700;
    }
    .formula {
      margin-top: var(--space-1);
      font-size: var(--text-xs);
      color: var(--ink-muted);
    }
    .result {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius);
      border: 1px solid var(--line);
    }
    .result-label {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-weight: 600;
    }
    .result-value {
      font-size: var(--text-xl);
      font-weight: 700;
    }
    .tone-success {
      background: var(--success-soft);
      border-color: var(--success);
    }
    .tone-warning {
      background: var(--warning-soft);
      border-color: var(--warning);
    }
    .tone-danger {
      background: var(--danger-soft);
      border-color: var(--danger);
    }
    .tone-danger .result-value {
      color: var(--danger-hover);
    }
    .tone-warning .result-value {
      color: var(--warning-ink);
    }
  `,
})
export class CloseSessionDialog {
  protected readonly ref = inject<DialogRef<CashSession>>(DialogRef);
  protected readonly session = inject<CashSession>(DIALOG_DATA);
  private readonly store = inject(CashSessionStore);
  private readonly toast = inject(ToastService);

  protected readonly folio = sessionFolio(this.session.folio);
  protected readonly totals = sessionTotals(this.session);
  protected readonly expected = this.totals.expectedCashCents;
  protected readonly saving = signal(false);

  protected readonly model = signal({ countedCashCents: this.expected, notes: '' });
  protected readonly closeForm = form(this.model, (s) => {
    maxLength(s.notes, 500, { message: 'Máximo 500 caracteres' });
  });

  protected readonly differenceCents = computed(
    () => this.model().countedCashCents - this.expected,
  );
  protected readonly difference = computed(() => cashDifference(this.differenceCents()));

  protected save(): void {
    void submit(this.closeForm, async (f) => {
      this.saving.set(true);
      try {
        const { countedCashCents, notes } = this.model();
        const closed = await this.store.close(countedCashCents, notes.trim() || undefined);
        const diff = closed.differenceCents ?? 0;
        const text = cashDifference(diff);
        this.toast.success(
          diff === 0
            ? `Caja ${this.folio} cerrada. El efectivo cuadra.`
            : `Caja ${this.folio} cerrada con ${text.label.toLowerCase()} de ${formatMoney(Math.abs(diff))}`,
        );
        this.ref.close(closed);
        return undefined;
      } catch (error) {
        const apiError = toApiError(error);
        const errors = serverFieldErrors(apiError, {
          countedCashCents: f.countedCashCents,
          notes: f.notes,
        });
        if (!errors.length) this.toast.error(apiError.message);
        if (apiError.code === 'CASH_SESSION_REQUIRED') {
          this.store.reload();
          this.ref.close();
        }
        return errors;
      } finally {
        this.saving.set(false);
      }
    });
  }
}
