import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { toApiError } from '../../../core/api/api-types';
import { PosBadge, PosButton, PosDialog, PosSpinner } from '../../../shared/ui';
import { formatDateTime } from '../../../shared/utils/format';
import { PosApi } from '../pos-api';
import { sessionFolio } from '../pos-models';
import { TicketPrinter } from '../ticket/ticket-printer';
import { PosCashBreakdown } from './cash-breakdown';
import { PosCashMovements } from './cash-movements';

export interface SessionDetailData {
  id: string;
  folio: number;
}

/** Detalle de un turno: cuadre, corte, ventas por forma de pago y movimientos de efectivo. */
@Component({
  selector: 'pos-session-detail-dialog',
  imports: [PosDialog, PosButton, PosBadge, PosSpinner, PosCashBreakdown, PosCashMovements],
  template: `
    <pos-dialog [heading]="'Turno ' + folio" [description]="subtitle()">
      @if (session.isLoading()) {
        <div class="center"><pos-spinner [size]="24" label="Cargando turno" /></div>
      } @else if (session.error()) {
        <p class="error" role="alert">{{ errorText() }}</p>
      } @else if (session.value(); as s) {
        <div class="detail">
          <p class="status">
            @if (s.status === 'open') {
              <pos-badge tone="brand">Abierta</pos-badge>
              <span>Desde {{ when(s.openedAt) }}</span>
            } @else {
              <pos-badge tone="neutral">Cerrada</pos-badge>
              <span
                >{{ when(s.openedAt) }} → {{ when(s.closedAt) }} · corte por
                {{ s.closedByName }}</span
              >
            }
          </p>
          <pos-cash-breakdown [session]="s" />
          <section>
            <h3 class="sub">Entradas y retiros</h3>
            <pos-cash-movements [movements]="s.movements" />
          </section>
          @if (s.notes) {
            <section>
              <h3 class="sub">Notas</h3>
              <p class="notes">{{ s.notes }}</p>
            </section>
          }
        </div>
      }
      <ng-container dialogActions>
        @if (tickets.ready() && session.hasValue()) {
          <button
            posButton
            variant="secondary"
            icon="printer"
            [loading]="printing()"
            (click)="print()"
          >
            Imprimir corte
          </button>
        }
        <button posButton variant="secondary" (click)="ref.close()">Cerrar</button>
      </ng-container>
    </pos-dialog>
  `,
  styles: `
    .center {
      display: grid;
      place-items: center;
      min-height: 10rem;
    }
    .detail {
      display: grid;
      gap: var(--space-5);
    }
    .status {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      color: var(--ink-muted);
    }
    .sub {
      margin-bottom: var(--space-2);
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }
    .notes {
      white-space: pre-line;
      font-size: var(--text-sm);
    }
    .error {
      color: var(--danger-hover);
    }
  `,
})
export class SessionDetailDialog {
  protected readonly ref = inject(DialogRef);
  private readonly data = inject<SessionDetailData>(DIALOG_DATA);
  private readonly api = inject(PosApi);
  protected readonly tickets = inject(TicketPrinter);
  protected readonly printing = signal(false);

  protected readonly folio = sessionFolio(this.data.folio);
  protected readonly when = formatDateTime;

  protected readonly session = resource({
    params: () => this.data.id,
    loader: ({ params }) => this.api.getSession(params),
  });

  protected readonly subtitle = computed(() =>
    this.session.hasValue() ? `Cajero: ${this.session.value().userName}` : '',
  );
  protected readonly errorText = computed(() => toApiError(this.session.error()).message);

  protected async print(): Promise<void> {
    if (!this.session.hasValue()) return;
    this.printing.set(true);
    try {
      await this.tickets.printCashClose(this.session.value());
    } finally {
      this.printing.set(false);
    }
  }
}
