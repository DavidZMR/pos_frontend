import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { unwrap } from '../../../core/api/api-types';
import type { TrendSeries } from '../../../shared/charts/chart-config';
import {
  deltaBp,
  formatBp,
  formatCount,
  formatCountCompact,
} from '../../../shared/charts/chart-format';
import { PosKpi } from '../../../shared/charts/kpi';
import { PosTrendChart } from '../../../shared/charts/trend-chart';
import { PosButton, PosCard, PosTable, type TableColumn } from '../../../shared/ui';
import { formatMoney } from '../../../shared/utils/format';
import { periodLabel, rangeLabel } from '../report-dates';
import { ReportFilters } from '../report-filters';
import type { SalesSeries, SeriesPoint, SummaryReport } from '../report-models';
import { ReportsApi } from '../reports-api';

/** Resumen: KPIs con comparación, tendencia de ventas y ganancia, y tickets por periodo. */
@Component({
  selector: 'pos-summary-view',
  imports: [PosButton, PosCard, PosKpi, PosTable, PosTrendChart],
  template: `
    @if (kpis(); as k) {
      <div class="kpis" [class.loading]="summary.isLoading()">
        <pos-kpi
          label="Ventas"
          [value]="k.sales"
          [deltaBp]="k.salesDelta"
          [previousLabel]="k.vs"
          [hero]="true"
        />
        <pos-kpi
          label="Ganancia"
          [value]="k.profit"
          [deltaBp]="k.profitDelta"
          [previousLabel]="k.vs"
        />
        <pos-kpi label="Margen" [value]="k.margin" [hint]="k.marginHint" />
        <pos-kpi
          label="Tickets"
          [value]="k.tickets"
          [deltaBp]="k.ticketsDelta"
          [previousLabel]="k.vs"
        />
        <pos-kpi
          label="Ticket promedio"
          [value]="k.avg"
          [deltaBp]="k.avgDelta"
          [previousLabel]="k.vs"
        />
        <pos-kpi
          label="Compras"
          [value]="k.purchases"
          [deltaBp]="k.purchasesDelta"
          [previousLabel]="k.vs"
          [upIsGood]="false"
        />
        <pos-kpi label="Canceladas" [value]="k.cancelled" [hint]="k.cancelledHint" />
      </div>
    }

    <div class="charts">
      <pos-card heading="Ventas y ganancia">
        <button
          cardActions
          posButton
          variant="ghost"
          size="sm"
          [icon]="showTable() ? 'chart' : 'menu'"
          (click)="showTable.set(!showTable())"
        >
          {{ showTable() ? 'Ver gráfica' : 'Ver tabla' }}
        </button>
        @if (showTable()) {
          <pos-table
            caption="Ventas por periodo"
            [columns]="columns"
            [rows]="points()"
            [loading]="series.isLoading()"
          />
        } @else {
          <pos-trend-chart
            kind="line"
            [labels]="labels()"
            [series]="trend()"
            [loading]="series.isLoading()"
            ariaLabel="Ventas y ganancia por periodo"
          />
        }
      </pos-card>
      <pos-card heading="Tickets por periodo">
        <pos-trend-chart
          kind="column"
          [labels]="labels()"
          [series]="tickets()"
          [format]="countFormat"
          [formatAxis]="countAxisFormat"
          [loading]="series.isLoading()"
          [height]="220"
          ariaLabel="Número de tickets por periodo"
        />
      </pos-card>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-5);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      gap: var(--space-3);
      transition: opacity var(--dur) var(--ease-out);
    }
    .kpis > :first-child {
      grid-column: span 2;
    }
    .kpis.loading {
      opacity: 0.45;
    }
    .charts {
      display: grid;
      gap: var(--space-5);
    }
    @media (max-width: 640px) {
      .kpis > :first-child {
        grid-column: auto;
      }
    }
  `,
})
export class SummaryView {
  private readonly api = inject(ReportsApi);
  protected readonly filters = inject(ReportFilters);
  protected readonly showTable = signal(false);
  protected readonly countFormat = formatCount;
  protected readonly countAxisFormat = formatCountCompact;

  protected readonly summary = httpResource<SummaryReport>(
    () => ({ url: this.api.url('summary'), params: this.filters.query() }),
    { parse: (body) => unwrap<SummaryReport>(body) },
  );
  protected readonly series = httpResource<SalesSeries>(
    () => ({ url: this.api.url('sales-series'), params: this.filters.query() }),
    { parse: (body) => unwrap<SalesSeries>(body) },
  );

  protected readonly kpis = computed(() => {
    if (!this.summary.hasValue()) return null;
    const { totals: t, previous } = this.summary.value();
    const p = previous.totals;
    return {
      vs: `vs. ${rangeLabel(previous.from, previous.to)}`,
      sales: formatMoney(t.salesCents),
      salesDelta: deltaBp(t.salesCents, p.salesCents),
      profit: formatMoney(t.profitCents),
      profitDelta: deltaBp(t.profitCents, p.profitCents),
      margin: formatBp(t.marginBp),
      marginHint: `Antes ${formatBp(p.marginBp)}`,
      tickets: formatCount(t.tickets),
      ticketsDelta: deltaBp(t.tickets, p.tickets),
      avg: formatMoney(t.avgTicketCents),
      avgDelta: deltaBp(t.avgTicketCents, p.avgTicketCents),
      purchases: formatMoney(t.purchasesCents),
      purchasesDelta: deltaBp(t.purchasesCents, p.purchasesCents),
      cancelled: formatCount(t.cancelledCount),
      cancelledHint: `${formatMoney(t.cancelledCents)} no cobrados`,
    };
  });

  protected readonly points = computed<(SeriesPoint & { label: string })[]>(() => {
    if (!this.series.hasValue()) return [];
    const { granularity, points } = this.series.value();
    return points.map((p) => ({ ...p, label: periodLabel(p.period, granularity) }));
  });
  protected readonly labels = computed(() => this.points().map((p) => p.label));
  protected readonly trend = computed<TrendSeries[]>(() => [
    { label: 'Ventas', values: this.points().map((p) => p.salesCents), slot: 1 },
    { label: 'Ganancia', values: this.points().map((p) => p.profitCents), slot: 2 },
  ]);
  protected readonly tickets = computed<TrendSeries[]>(() => [
    { label: 'Tickets', values: this.points().map((p) => p.tickets), slot: 1 },
  ]);

  protected readonly columns: TableColumn<SeriesPoint & { label: string }>[] = [
    { key: 'label', header: 'Periodo' },
    { key: 'salesCents', header: 'Ventas', type: 'money' },
    { key: 'costCents', header: 'Costo', type: 'money', hideOnMobile: true },
    { key: 'profitCents', header: 'Ganancia', type: 'money' },
    { key: 'tickets', header: 'Tickets', type: 'number' },
    { key: 'avgTicketCents', header: 'Ticket prom.', type: 'money', hideOnMobile: true },
  ];
}
