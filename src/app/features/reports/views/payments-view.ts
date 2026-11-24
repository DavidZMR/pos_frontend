import { httpResource } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { unwrap } from '../../../core/api/api-types';
import type { ChartSlot } from '../../../shared/charts/chart-config';
import { plural } from '../../../shared/charts/chart-format';
import { type HeatCell, PosHeatmap } from '../../../shared/charts/heatmap';
import { PosRankedBars, type RankedBar } from '../../../shared/charts/ranked-bars';
import { PosSegmentedBar, type Segment } from '../../../shared/charts/segmented-bar';
import { PosCard } from '../../../shared/ui';
import { formatMoney } from '../../../shared/utils/format';
import { PAYMENT_LABEL, PAYMENT_METHODS } from '../../pos/pos-models';
import { ReportFilters } from '../report-filters';
import type { PaymentsReport } from '../report-models';
import { ReportsApi } from '../reports-api';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/**
 * Formas de pago, cajeros y horas pico. Con categoría o producto cuenta solo esos renglones de
 * cada ticket (cuadra con el resumen).
 */
@Component({
  selector: 'pos-payments-view',
  imports: [PosCard, PosHeatmap, PosRankedBars, PosSegmentedBar],
  template: `
    <div class="pair">
      <pos-card heading="Formas de pago">
        <pos-segmented-bar
          [segments]="methods()"
          [loading]="report.isLoading()"
          ariaLabel="Ventas por forma de pago"
        />
      </pos-card>
      <pos-card heading="Ventas por cajero">
        <pos-ranked-bars
          [items]="cashiers()"
          [loading]="report.isLoading()"
          [showRank]="false"
          ariaLabel="Ventas por cajero"
        />
      </pos-card>
    </div>
    <pos-card heading="Horas pico">
      <p class="note">
        Tickets por día de la semana y hora (hora local del negocio). Pasa el cursor por una celda
        para ver el detalle.
      </p>
      <pos-heatmap
        [rows]="weekdays"
        [cols]="hours()"
        [cells]="cells()"
        [loading]="report.isLoading()"
        ariaLabel="Tickets por día y hora"
      />
    </pos-card>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-5);
    }
    .pair {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
      gap: var(--space-5);
      align-items: start;
    }
    .note {
      margin-bottom: var(--space-3);
      font-size: var(--text-sm);
      color: var(--ink-muted);
    }
  `,
})
export class PaymentsView {
  private readonly api = inject(ReportsApi);
  private readonly filters = inject(ReportFilters);

  protected readonly report = httpResource<PaymentsReport>(
    () => ({ url: this.api.url('payments'), params: this.filters.query() }),
    { parse: (body) => unwrap<PaymentsReport>(body) },
  );

  protected readonly weekdays = WEEKDAYS.map((label, i) => ({ id: i + 1, label }));

  /** El color sigue a la forma de pago (efectivo = 1, tarjeta = 2…), no a su lugar. */
  protected readonly methods = computed<Segment[]>(() =>
    this.report.hasValue()
      ? this.report.value().byMethod.map((m) => ({
          id: m.method,
          label: PAYMENT_LABEL[m.method].label,
          value: m.amountCents,
          valueText: formatMoney(m.amountCents),
          slot: (PAYMENT_METHODS.indexOf(m.method) + 1) as ChartSlot,
        }))
      : [],
  );

  protected readonly cashiers = computed<RankedBar[]>(() =>
    this.report.hasValue()
      ? this.report.value().byCashier.map((c) => ({
          id: c.cashierId,
          label: c.name,
          sublabel: `${plural(c.tickets, 'ticket', 'tickets')} · promedio ${formatMoney(c.avgTicketCents)}`,
          value: c.salesCents,
          valueText: formatMoney(c.salesCents),
        }))
      : [],
  );

  /** Columnas: de la primera a la última hora con ventas (mínimo 9 a 21 h). */
  protected readonly hours = computed(() => {
    const used = this.report.hasValue() ? this.report.value().hours.map((h) => h.hour) : [];
    const first = Math.min(9, ...used);
    const last = Math.max(20, ...used);
    return Array.from({ length: last - first + 1 }, (_, i) => ({
      id: first + i,
      label: String(first + i),
    }));
  });

  protected readonly cells = computed<HeatCell[]>(() =>
    this.report.hasValue()
      ? this.report.value().hours.map((h) => ({
          row: h.weekday,
          col: h.hour,
          value: h.tickets,
          text: `${WEEKDAY_NAMES[h.weekday - 1]} ${h.hour}:00 – ${h.hour + 1}:00 · ${plural(h.tickets, 'ticket', 'tickets')} · ${formatMoney(h.salesCents)}`,
        }))
      : [],
  );
}
