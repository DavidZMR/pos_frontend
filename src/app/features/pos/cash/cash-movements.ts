import { Component, input } from '@angular/core';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { PosIcon } from '../../../shared/ui';
import { formatDateTime } from '../../../shared/utils/format';
import type { CashMovement } from '../pos-models';

/** Lista de entradas y retiros de efectivo de un turno. */
@Component({
  selector: 'pos-cash-movements',
  imports: [MoneyPipe, PosIcon],
  template: `
    @if (movements().length) {
      <ol class="list">
        @for (m of movements(); track $index) {
          <li class="row" [class]="m.type">
            <span class="mark" aria-hidden="true">
              <pos-icon [name]="m.type === 'in' ? 'arrow-down' : 'arrow-up'" [size]="16" />
            </span>
            <span class="text">
              <span class="reason">{{ m.reason }}</span>
              <span class="meta">{{ when(m.at) }} · {{ m.userName }}</span>
            </span>
            <span class="amount num">
              <span class="visually-hidden">{{ m.type === 'in' ? 'Entrada' : 'Retiro' }}</span>
              {{ m.type === 'in' ? '+' : '−' }} {{ m.amountCents | money }}
            </span>
          </li>
        }
      </ol>
    } @else {
      <p class="empty">Sin entradas ni retiros de efectivo.</p>
    }
  `,
  styles: `
    .list {
      display: grid;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px dotted var(--line);
    }
    .row:last-child {
      border-bottom: none;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: var(--success-soft);
      color: var(--success);
    }
    .out .mark {
      background: var(--danger-soft);
      color: var(--danger);
    }
    .text {
      display: grid;
      min-width: 0;
    }
    .reason {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .meta {
      font-size: var(--text-xs);
      color: var(--ink-muted);
    }
    .amount {
      font-weight: 700;
    }
    .out .amount {
      color: var(--danger-hover);
    }
    .empty {
      font-size: var(--text-sm);
      color: var(--ink-muted);
    }
  `,
})
export class PosCashMovements {
  readonly movements = input.required<readonly CashMovement[]>();
  protected readonly when = formatDateTime;
}
