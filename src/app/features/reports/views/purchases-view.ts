import { httpResource } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { unwrap } from '../../../core/api/api-types';
import { formatBp, formatCount } from '../../../shared/charts/chart-format';
import { PosKpi } from '../../../shared/charts/kpi';
import { PosRankedBars, type RankedBar } from '../../../shared/charts/ranked-bars';
import { PosTrendChart } from '../../../shared/charts/trend-chart';
import { PosCard, PosTable, type TableColumn } from '../../../shared/ui';
import { formatMoney } from '../../../shared/utils/format';
import { periodLabel } from '../report-dates';
import { ReportFilters } from '../report-filters';
import type { PurchasesReport } from '../report-models';
import { ReportsApi } from '../reports-api';

type ProductRow = PurchasesReport['byProduct'][number];

/** Compras (entradas de mercancía): por periodo, proveedor y producto. */
@Component({
  selector: 'pos-purchases-view',
  imports: [PosCard, PosKpi, PosRankedBars, PosTable, PosTrendChart],
  template: `
    @if (report.hasValue()) {
      <div class="kpis">
        <pos-kpi label="Total comprado" [value]="total()" [hero]="true" />
        <pos-kpi label="Entradas" [value]="count()" hint="Compras registradas (sin canceladas)" />
      </div>
    }
    <pos-card heading="Compras por periodo">
      <pos-trend-chart
        kind="column"
        [labels]="labels()"
        [series]="series()"
        [loading]="report.isLoading()"
        ariaLabel="Compras por periodo"
      />
    </pos-card>
    <div class="pair">
      <pos-card heading="Por proveedor">
        <pos-ranked-bars
          [items]="suppliers()"
          [showRank]="false"
          [loading]="report.isLoading()"
          ariaLabel="Compras por proveedor"
        />
      </pos-card>
      <pos-card heading="Productos comprados" [flush]="true">
        <pos-table
          caption="Productos comprados"
          [columns]="columns"
          [rows]="products()"
          [loading]="report.isLoading()"
          emptyTitle="Sin compras"
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
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: var(--space-3);
    }
    .pair {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
      gap: var(--space-5);
      align-items: start;
    }
    @media (max-width: 640px) {
      .pair {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class PurchasesView {
  private readonly api = inject(ReportsApi);
  private readonly filters = inject(ReportFilters);

  protected readonly report = httpResource<PurchasesReport>(
    () => {
      const { from, to, granularity, productId, scope } = this.filters.query() as Record<
        string,
        string
      >;
      return {
        url: this.api.url('purchases'),
        params: Object.fromEntries(
          Object.entries({ from, to, granularity, productId, scope }).filter(([, v]) => v),
        ) as Record<string, string>,
      };
    },
    { parse: (body) => unwrap<PurchasesReport>(body) },
  );

  protected readonly total = computed(() =>
    this.report.hasValue() ? formatMoney(this.report.value().totalCents) : '',
  );
  protected readonly count = computed(() =>
    this.report.hasValue() ? formatCount(this.report.value().count) : '',
  );
  protected readonly labels = computed(() => {
    if (!this.report.hasValue()) return [];
    const { points, granularity } = this.report.value();
    return points.map((p) => periodLabel(p.period, granularity));
  });
  protected readonly series = computed(() => [
    {
      label: 'Compras',
      values: this.report.hasValue() ? this.report.value().points.map((p) => p.totalCents) : [],
      slot: 1 as const,
    },
  ]);
  protected readonly suppliers = computed<RankedBar[]>(() =>
    this.report.hasValue()
      ? this.report.value().bySupplier.map((s) => ({
          id: s.supplierId ?? 'none',
          label: s.name,
          sublabel: `${formatCount(s.count)} entradas`,
          value: s.totalCents,
          valueText: formatMoney(s.totalCents),
          detail: formatBp(s.shareBp),
        }))
      : [],
  );
  protected readonly products = computed<ProductRow[]>(() =>
    this.report.hasValue() ? this.report.value().byProduct : [],
  );
  protected readonly columns: TableColumn<ProductRow>[] = [
    { key: 'name', header: 'Producto' },
    { key: 'qtyBase', header: 'Cantidad', type: 'qty', unit: (r) => r.unit },
    { key: 'totalCents', header: 'Total', type: 'money' },
    { key: 'avgUnitCostCents', header: 'Costo prom.', type: 'money', hideOnMobile: true },
  ];
}
