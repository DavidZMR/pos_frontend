import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { type Page, toApiError, toPage, unwrap } from '../../../core/api/api-types';
import { BusinessContext } from '../../../core/business/business-context';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { QtyPipe } from '../../../shared/pipes/qty-pipe';
import {
  type BadgeTone,
  DialogService,
  PosBadge,
  PosBusinessGate,
  PosButton,
  PosCellDef,
  PosInput,
  PosPageHeader,
  PosSelect,
  PosStatTile,
  PosTable,
  type SelectOption,
  type TableColumn,
  type TableSort,
  ToastService,
} from '../../../shared/ui';
import { debounced } from '../../../shared/utils/debounced';
import { formatMoney } from '../../../shared/utils/format';
import { lineTotalCents } from '../../../shared/utils/money';
import { unitScale } from '../../../shared/utils/qty';
import { CatalogApi, cleanParams } from '../../catalog/catalog-api';
import { CatalogLookups } from '../../catalog/catalog-lookups';
import {
  type Product,
  STOCK_STATUS_LABEL,
  type StockStatus,
  stockStatus,
} from '../../catalog/catalog-models';
import { InventoryApi } from '../inventory-api';
import type { InventorySummary } from '../inventory-models';
import { AdjustmentDialog } from './adjustment-dialog';

const STOCK_TONE: Record<StockStatus, BadgeTone> = {
  ok: 'success',
  low: 'warning',
  out: 'neutral',
  negative: 'danger',
};

@Component({
  selector: 'pos-stock-page',
  imports: [
    RouterLink,
    PosBusinessGate,
    PosPageHeader,
    PosStatTile,
    PosButton,
    PosInput,
    PosSelect,
    PosTable,
    PosCellDef,
    PosBadge,
    MoneyPipe,
    QtyPipe,
  ],
  templateUrl: './stock-page.html',
  styles: `
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }
  `,
})
export class StockPage {
  private readonly catalog = inject(CatalogApi);
  private readonly inventory = inject(InventoryApi);
  protected readonly lookups = inject(CatalogLookups);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  protected readonly context = inject(BusinessContext);

  protected readonly stockLabel = STOCK_STATUS_LABEL;
  protected readonly stockTone = STOCK_TONE;
  protected readonly stockStatus = stockStatus;

  protected readonly searchText = signal('');
  protected readonly categoryId = signal('');
  /** `?stock=low` / `?stock=out` (p. ej. desde el Tablero) abre la lista ya filtrada. */
  protected readonly stockFilter = signal(
    ['low', 'out'].find((v) => v === inject(ActivatedRoute).snapshot.queryParamMap.get('stock')) ??
      '',
  );
  protected readonly sort = signal<TableSort | undefined>({ key: 'name', direction: 'asc' });
  private readonly search = debounced(this.searchText);
  protected readonly page = linkedSignal({
    source: () => [
      this.search(),
      this.categoryId(),
      this.stockFilter(),
      this.sort(),
      this.context.scope(),
    ],
    computation: () => 1,
  });

  protected readonly categoryFilterOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Todas' },
    ...this.lookups.categoryOptions(),
  ]);
  protected readonly stockOptions: SelectOption[] = [
    { value: '', label: 'Todas' },
    { value: 'low', label: 'Bajo mínimo' },
    { value: 'out', label: 'Agotados' },
  ];

  protected readonly summary = httpResource<InventorySummary>(
    () => (this.context.scope() ? this.inventory.summaryUrl : undefined),
    { parse: (body) => unwrap<InventorySummary>(body) },
  );

  protected readonly products = httpResource<Page<Product>>(
    () => {
      if (!this.context.scope()) return undefined;
      const sort = this.sort();
      return {
        url: this.catalog.productsUrl,
        params: cleanParams({
          page: this.page(),
          limit: 25,
          active: 'true',
          search: this.search().trim(),
          categoryId: this.categoryId(),
          stock: this.stockFilter(),
          sort: sort?.key,
          order: sort?.direction,
        }),
      };
    },
    { parse: (body) => toPage<Product>(body) },
  );

  protected readonly rows = computed(() =>
    this.products.hasValue() ? this.products.value().items : [],
  );
  protected readonly meta = computed(() =>
    this.products.hasValue() ? this.products.value().meta : undefined,
  );

  protected readonly tiles = computed(() => {
    const s = this.summary.hasValue() ? this.summary.value() : null;
    return {
      value: s ? formatMoney(s.inventoryValueCents) : '—',
      products: s ? String(s.products) : '—',
      low: s ? String(s.lowStock) : '—',
      out: s ? String(s.outOfStock) : '—',
      negative: s?.negativeStock ?? 0,
    };
  });

  protected readonly columns: TableColumn<Product>[] = [
    { key: 'code', header: 'Código', width: '6.5rem', sortable: true },
    { key: 'name', header: 'Producto', sortable: true },
    { key: 'stock', header: 'Existencia', align: 'end', sortable: true, width: '10rem' },
    { key: 'minStock', header: 'Mínimo', align: 'end', hideOnMobile: true, width: '8rem' },
    { key: 'costCents', header: 'Costo prom.', align: 'end', hideOnMobile: true, width: '8.5rem' },
    { key: 'value', header: 'Valor', align: 'end', hideOnMobile: true, width: '9rem' },
    { key: 'actions', header: '', align: 'end', width: '8.5rem' },
  ];

  constructor() {
    effect(() => {
      const error = this.products.error() ?? this.summary.error();
      if (error) this.toast.error(toApiError(error).message);
    });
  }

  /** Valor del renglón: existencia positiva × costo promedio. */
  protected value(product: Product): number {
    return lineTotalCents(product.costCents, Math.max(product.stock, 0), unitScale(product.unit));
  }

  protected adjust(product: Product): void {
    this.dialogs
      .open<Product, Product>(AdjustmentDialog, { data: product })
      .closed.subscribe((updated) => {
        if (updated) {
          this.products.reload();
          this.summary.reload();
        }
      });
  }
}
