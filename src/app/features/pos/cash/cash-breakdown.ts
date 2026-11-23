import { Component, computed, input } from '@angular/core';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { PosBadge } from '../../../shared/ui';
import {
  type CashSession,
  PAYMENT_LABEL,
  PAYMENT_METHODS,
  cashDifference,
  sessionTotals,
} from '../pos-models';

/**
 * Cuadre de efectivo de un turno (fondo + ventas en efectivo + entradas − retiros = esperado) y,
 * si ya se hizo el corte, lo contado y la diferencia. Debajo, las ventas por forma de pago.
 */
@Component({
  selector: 'pos-cash-breakdown',
  imports: [MoneyPipe, PosBadge],
  template: `
    <dl class="ledger">
      <div>
        <dt>Fondo inicial</dt>
        <dd class="num">{{ session().openingFloatCents | money }}</dd>
      </div>
      <div>
        <dt>Ventas en efectivo</dt>
        <dd class="num">+ {{ totals().byMethod.cash | money }}</dd>
      </div>
      <div>
        <dt>Entradas de efectivo</dt>
        <dd class="num">+ {{ totals().cashInCents | money }}</dd>
      </div>
      <div>
        <dt>Retiros</dt>
        <dd class="num">− {{ totals().cashOutCents | money }}</dd>
      </div>
      <div class="sum">
        <dt>Efectivo esperado</dt>
        <dd class="num">{{ totals().expectedCashCents | money }}</dd>
      </div>
      @if (session().countedCashCents !== null) {
        <div>
          <dt>Efectivo contado</dt>
          <dd class="num">{{ session().countedCashCents | money }}</dd>
        </div>
        @if (difference(); as diff) {
          <div class="diff" [class]="'tone-' + diff.tone">
            <dt>
              Diferencia <pos-badge [tone]="diff.tone">{{ diff.label }}</pos-badge>
            </dt>
            <dd class="num">{{ session().differenceCents | money }}</dd>
          </div>
        }
      }
    </dl>

    <h3 class="sub">Ventas del turno</h3>
    <dl class="ledger">
      @for (method of methods; track method) {
        <div>
          <dt>{{ labels[method].label }}</dt>
          <dd class="num">{{ totals().byMethod[method] | money }}</dd>
        </div>
      }
      <div class="sum">
        <dt>
          Total vendido <span class="count">{{ ticketsText() }}</span>
        </dt>
        <dd class="num">{{ totals().salesTotalCents | money }}</dd>
      </div>
    </dl>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
    }
    .ledger {
      display: grid;
      margin: 0;
      font-size: var(--text-sm);
    }
    .ledger > div {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px dotted var(--line);
      color: var(--ink-muted);
    }
    dt {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }
    dd {
      margin: 0;
      color: var(--ink);
    }
    .ledger > .sum {
      border-bottom: none;
      border-top: 1px solid var(--line-strong);
      color: var(--ink);
      font-weight: 700;
    }
    .ledger > .sum dd {
      font-size: var(--text-lg);
    }
    .diff.tone-danger dd {
      color: var(--danger);
      font-weight: 700;
    }
    .diff.tone-warning dd {
      color: var(--warning-ink);
      font-weight: 700;
    }
    .diff.tone-success dd {
      color: var(--success);
      font-weight: 700;
    }
    .sub {
      margin-top: var(--space-2);
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
    .count {
      font-weight: 400;
      color: var(--ink-muted);
    }
  `,
})
export class PosCashBreakdown {
  readonly session = input.required<CashSession>();

  protected readonly labels = PAYMENT_LABEL;
  protected readonly methods = PAYMENT_METHODS;
  protected readonly totals = computed(() => sessionTotals(this.session()));
  protected readonly difference = computed(() => {
    const diff = this.session().differenceCents;
    return diff === null ? null : cashDifference(diff);
  });
  protected readonly ticketsText = computed(() => {
    const { salesCount, cancelledCount } = this.totals();
    const tickets = `${salesCount} ${salesCount === 1 ? 'ticket' : 'tickets'}`;
    return cancelledCount > 0 ? `· ${tickets}, ${cancelledCount} cancelado(s)` : `· ${tickets}`;
  });
}
