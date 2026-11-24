import { httpResource } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { unwrap } from '../../../core/api/api-types';
import { formatBp, formatCount } from '../../../shared/charts/chart-format';
import { PosRankedBars, type RankedBar } from '../../../shared/charts/ranked-bars';
import { PosCard, PosTable, type TableColumn } from '../../../shared/ui';
import { formatMoney } from '../../../shared/utils/format';
import { ReportFilters } from '../report-filters';
import type { BusinessesReport, BusinessRow } from '../report-models';
import { ReportsApi } from '../reports-api';

/** Comparativa entre negocios (superadmin). Usa solo el rango de fechas. */
@Component({
  selector: 'pos-businesses-view',
  imports: [PosCard, PosRankedBars, PosTable],
  template: `
    <pos-card heading="Ventas por negocio">
      <pos-ranked-bars
        [items]="bars()"
        [loading]="report.isLoading()"
        ariaLabel="Ventas por negocio"
      />
    </pos-card>
    <pos-card heading="Detalle" [flush]="true">
      <pos-table
        caption="Comparativa de negocios"
        [columns]="columns"
        [rows]="rows()"
        [loading]="report.isLoading()"
      />
    </pos-card>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-5);
    }
  `,
})
export class BusinessesView {
  private readonly api = inject(ReportsApi);
  private readonly filters = inject(ReportFilters);

  protected readonly report = httpResource<BusinessesReport>(
    () => ({ url: this.api.url('businesses'), params: this.filters.range() }),
    { parse: (body) => unwrap<BusinessesReport>(body) },
  );

  protected readonly rows = computed<BusinessRow[]>(() =>
    this.report.hasValue() ? this.report.value().items : [],
  );
  protected readonly bars = computed<RankedBar[]>(() =>
    this.rows().map((b) => ({
      id: b.businessId,
      label: b.active ? b.name : `${b.name} (inactivo)`,
      sublabel: `${formatCount(b.tickets)} tickets · margen ${formatBp(b.marginBp)}`,
      value: b.salesCents,
      valueText: formatMoney(b.salesCents),
      detail: formatBp(b.shareBp),
    })),
  );
  protected readonly columns: TableColumn<BusinessRow>[] = [
    { key: 'name', header: 'Negocio' },
    { key: 'salesCents', header: 'Ventas', type: 'money' },
    { key: 'profitCents', header: 'Ganancia', type: 'money' },
    { key: 'marginBp', header: 'Margen', value: (b) => formatBp(b.marginBp), align: 'end' },
    { key: 'tickets', header: 'Tickets', type: 'number', hideOnMobile: true },
    { key: 'avgTicketCents', header: 'Ticket prom.', type: 'money', hideOnMobile: true },
    { key: 'purchasesCents', header: 'Compras', type: 'money', hideOnMobile: true },
  ];
}
