import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { unwrap } from '../../../core/api/api-types';
import { formatBp, plural } from '../../../shared/charts/chart-format';
import { PosRankedBars, type RankedBar } from '../../../shared/charts/ranked-bars';
import { PosCard, PosSelect, type SelectOption } from '../../../shared/ui';
import { formatMoney, formatQty } from '../../../shared/utils/format';
import type { Unit } from '../../../shared/utils/qty';
import { ReportFilters } from '../report-filters';
import type { CategoriesReport, TopProduct, TopProductsReport, TopSort } from '../report-models';
import { ReportsApi } from '../reports-api';

type SortChoice = 'amount' | 'profit' | 'tickets' | 'qty-kg' | 'qty-pz' | 'qty-l';

const SORT_OPTIONS: SelectOption[] = [
  { value: 'amount', label: 'Importe vendido' },
  { value: 'profit', label: 'Ganancia' },
  { value: 'tickets', label: 'Veces vendido (tickets)' },
  { value: 'qty-kg', label: 'Cantidad: kilos' },
  { value: 'qty-pz', label: 'Cantidad: piezas' },
  { value: 'qty-l', label: 'Cantidad: litros' },
];

/** Lo más vendido y ventas por categoría (con participación y margen). */
@Component({
  selector: 'pos-products-view',
  imports: [PosCard, PosRankedBars, PosSelect],
  template: `
    <pos-card heading="Lo más vendido">
      <div cardActions class="sort">
        <pos-select
          label="Ordenar por"
          [options]="sortOptions"
          [value]="sort()"
          (valueChange)="sort.set($any($event))"
        />
      </div>
      <p class="note">{{ note() }}</p>
      <pos-ranked-bars
        [items]="topBars()"
        [loading]="top.isLoading()"
        ariaLabel="Productos más vendidos"
        emptyText="Sin ventas de productos con estos filtros."
      />
    </pos-card>

    <pos-card heading="Ventas por categoría">
      <pos-ranked-bars
        [items]="categoryBars()"
        [loading]="categories.isLoading()"
        [showRank]="false"
        ariaLabel="Ventas por categoría"
      />
    </pos-card>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-5);
    }
    .sort {
      min-width: 14rem;
    }
    .note {
      margin-bottom: var(--space-3);
      font-size: var(--text-sm);
      color: var(--ink-muted);
    }
  `,
})
export class ProductsView {
  private readonly api = inject(ReportsApi);
  private readonly filters = inject(ReportFilters);

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly sort = signal<SortChoice>('amount');

  private readonly sortParams = computed<{ sort: TopSort; unit?: Unit }>(() => {
    const choice = this.sort();
    return choice.startsWith('qty-')
      ? { sort: 'qty', unit: choice.slice(4) as Unit }
      : { sort: choice as TopSort };
  });

  protected readonly top = httpResource<TopProductsReport>(
    () => ({
      url: this.api.url('top-products'),
      params: { ...this.filters.query(), ...this.sortParams(), limit: 20 },
    }),
    { parse: (body) => unwrap<TopProductsReport>(body) },
  );
  protected readonly categories = httpResource<CategoriesReport>(
    () => ({ url: this.api.url('categories'), params: this.filters.query() }),
    { parse: (body) => unwrap<CategoriesReport>(body) },
  );

  protected readonly note = computed(() => {
    const choice = this.sort();
    if (choice.startsWith('qty-')) {
      return 'Por cantidad se comparan productos de la misma unidad (no se suman kilos con piezas).';
    }
    if (choice === 'tickets') return 'Cuántos tickets incluyeron cada producto.';
    if (choice === 'profit') return 'Ganancia = venta − costo al momento de cada venta.';
    return 'Importe vendido con el precio de cada venta (no el precio actual).';
  });

  protected readonly topBars = computed<RankedBar[]>(() => {
    if (!this.top.hasValue()) return [];
    const choice = this.sort();
    return this.top.value().items.map((p: TopProduct) => {
      const qty = formatQty(p.qtyBase, p.unit);
      const value =
        choice === 'profit'
          ? p.profitCents
          : choice === 'tickets'
            ? p.tickets
            : choice.startsWith('qty-')
              ? p.qtyBase
              : p.salesCents;
      const valueText =
        choice === 'profit'
          ? formatMoney(p.profitCents)
          : choice === 'tickets'
            ? plural(p.tickets, 'ticket', 'tickets')
            : choice.startsWith('qty-')
              ? qty
              : formatMoney(p.salesCents);
      return {
        id: p.productId,
        label: p.name,
        sublabel:
          choice === 'amount' || choice === 'tickets'
            ? `${p.code} · ${qty} · margen ${formatBp(p.marginBp)}`
            : `${p.code} · ${formatMoney(p.salesCents)}`,
        value,
        valueText,
        detail: formatBp(p.shareBp),
      };
    });
  });

  protected readonly categoryBars = computed<RankedBar[]>(() =>
    this.categories.hasValue()
      ? this.categories.value().items.map((c) => ({
          id: c.categoryId ?? 'none',
          label: c.name,
          sublabel: `Ganancia ${formatMoney(c.profitCents)} · margen ${formatBp(c.marginBp)}`,
          value: c.salesCents,
          valueText: formatMoney(c.salesCents),
          detail: formatBp(c.shareBp),
        }))
      : [],
  );
}
