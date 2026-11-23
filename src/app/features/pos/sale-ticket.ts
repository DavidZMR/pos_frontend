import { Component, computed, input } from '@angular/core';
import { MoneyPipe } from '../../shared/pipes/money-pipe';
import { QtyPipe } from '../../shared/pipes/qty-pipe';
import { formatDateTime } from '../../shared/utils/format';
import { PAYMENT_LABEL, type Sale, saleFolio } from './pos-models';

/**
 * Venta con formato de ticket (renglones, IVA, pagos, cambio). Se usa en el detalle de venta
 * y será la base del ticket impreso (Fase 5).
 */
@Component({
  selector: 'pos-sale-ticket',
  imports: [MoneyPipe, QtyPipe],
  template: `
    <header class="head">
      <p class="folio num">{{ folio() }}</p>
      <p class="meta">{{ when() }} · Atendió {{ sale().cashierName }}</p>
    </header>
    <ol class="items">
      @for (item of sale().items; track $index) {
        <li class="item">
          <span class="name">{{ item.name }}</span>
          <span class="calc num">
            {{ item.qtyBase | qty: item.unit }} × {{ item.unitPriceCents | money }}
          </span>
          <span class="amount num">{{ item.lineTotalCents | money }}</span>
        </li>
      }
    </ol>
    <dl class="totals">
      <div>
        <dt>IVA incluido</dt>
        <dd class="num">{{ sale().taxCents | money }}</dd>
      </div>
      <div class="grand">
        <dt>Total</dt>
        <dd class="num">{{ sale().totalCents | money }}</dd>
      </div>
      @for (payment of sale().payments; track payment.method) {
        <div>
          <dt>{{ labels[payment.method].label }}</dt>
          <dd class="num">{{ payment.amountCents | money }}</dd>
        </div>
      }
      @if (sale().changeCents > 0) {
        <div>
          <dt>Recibido</dt>
          <dd class="num">{{ sale().cashReceivedCents | money }}</dd>
        </div>
        <div>
          <dt>Cambio</dt>
          <dd class="num">{{ sale().changeCents | money }}</dd>
        </div>
      }
    </dl>
  `,
  styles: `
    :host {
      display: block;
      padding: var(--space-5);
      background: var(--surface-raised);
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius);
    }
    .head {
      text-align: center;
      padding-bottom: var(--space-3);
      border-bottom: 1px dashed var(--line-strong);
    }
    .folio {
      font-family: var(--font-display);
      font-stretch: var(--display-stretch);
      font-size: var(--text-xl);
      font-weight: 700;
    }
    .meta {
      font-size: var(--text-xs);
      color: var(--ink-muted);
    }
    .items {
      margin: 0;
      padding: var(--space-3) 0;
      list-style: none;
      border-bottom: 1px dashed var(--line-strong);
    }
    .item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0 var(--space-3);
      padding: var(--space-1) 0;
    }
    .name {
      font-weight: 600;
    }
    .calc {
      grid-column: 1;
      font-size: var(--text-xs);
      color: var(--ink-muted);
    }
    .amount {
      grid-column: 2;
      grid-row: 1 / span 2;
      align-self: center;
    }
    .totals {
      display: grid;
      gap: var(--space-1);
      margin: var(--space-3) 0 0;
      font-size: var(--text-sm);
    }
    .totals > div {
      display: flex;
      justify-content: space-between;
      color: var(--ink-muted);
    }
    dd {
      margin: 0;
    }
    .grand {
      color: var(--ink);
      font-weight: 700;
      font-size: var(--text-lg);
    }
  `,
})
export class PosSaleTicket {
  readonly sale = input.required<Sale>();
  protected readonly labels = PAYMENT_LABEL;
  protected readonly folio = computed(() => saleFolio(this.sale().folio));
  protected readonly when = computed(() => formatDateTime(this.sale().createdAt));
}
