import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type Page, toApiError, toPage } from '../../../core/api/api-types';
import { BusinessContext } from '../../../core/business/business-context';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { QtyPipe } from '../../../shared/pipes/qty-pipe';
import {
  type BadgeTone,
  ConfirmService,
  DialogService,
  PosBadge,
  PosBusinessGate,
  PosButton,
  PosCellDef,
  PosInput,
  PosPageHeader,
  PosSelect,
  PosTable,
  type SelectOption,
  type TableColumn,
  type TableSort,
  ToastService,
} from '../../../shared/ui';
import { debounced } from '../../../shared/utils/debounced';
import { UNITS } from '../../../shared/utils/qty';
import { CatalogApi, cleanParams } from '../catalog-api';
import { CatalogLookups } from '../catalog-lookups';
import { type Product, STOCK_STATUS_LABEL, type StockStatus, stockStatus } from '../catalog-models';
import { PriceHistoryDialog } from './price-history-dialog';
import { type ProductFormData, ProductFormDialog } from './product-form-dialog';

const STOCK_TONE: Record<StockStatus, BadgeTone> = {
  ok: 'success',
  low: 'warning',
  out: 'neutral',
  negative: 'danger',
};

@Component({
  selector: 'pos-products-page',
  imports: [
    RouterLink,
    PosBusinessGate,
    PosPageHeader,
    PosButton,
    PosInput,
    PosSelect,
    PosTable,
    PosCellDef,
    PosBadge,
    MoneyPipe,
    QtyPipe,
  ],
  templateUrl: './products-page.html',
})
export class ProductsPage {
  private readonly api = inject(CatalogApi);
  protected readonly lookups = inject(CatalogLookups);
  private readonly dialogs = inject(DialogService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly context = inject(BusinessContext);

  protected readonly units = UNITS;
  protected readonly stockLabel = STOCK_STATUS_LABEL;
  protected readonly stockTone = STOCK_TONE;
  protected readonly stockStatus = stockStatus;

  protected readonly searchText = signal('');
  protected readonly categoryId = signal('');
  protected readonly stockFilter = signal('');
  protected readonly status = signal('true');
  protected readonly sort = signal<TableSort | undefined>({ key: 'name', direction: 'asc' });
  private readonly search = debounced(this.searchText);
  protected readonly page = linkedSignal({
    source: () => [
      this.search(),
      this.categoryId(),
      this.stockFilter(),
      this.status(),
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
  protected readonly statusOptions: SelectOption[] = [
    { value: 'true', label: 'Activos' },
    { value: 'false', label: 'Inactivos' },
    { value: '', label: 'Todos' },
  ];

  protected readonly products = httpResource<Page<Product>>(
    () => {
      if (!this.context.scope()) return undefined;
      const sort = this.sort();
      return {
        url: this.api.productsUrl,
        params: cleanParams({
          page: this.page(),
          limit: 25,
          search: this.search().trim(),
          categoryId: this.categoryId(),
          stock: this.stockFilter(),
          active: this.status(),
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

  protected readonly columns: TableColumn<Product>[] = [
    { key: 'code', header: 'Código', width: '6.5rem', sortable: true },
    { key: 'name', header: 'Producto', sortable: true },
    { key: 'salePriceCents', header: 'Precio', align: 'end', sortable: true, width: '9rem' },
    { key: 'costCents', header: 'Costo', align: 'end', hideOnMobile: true, width: '8rem' },
    { key: 'stock', header: 'Existencia', align: 'end', sortable: true, width: '10rem' },
    { key: 'actions', header: '', align: 'end', width: '9.5rem' },
  ];

  constructor() {
    effect(() => {
      const error = this.products.error();
      if (error) this.toast.error(toApiError(error).message);
    });
  }

  protected openForm(product?: Product): void {
    this.dialogs
      .open<Product, ProductFormData>(ProductFormDialog, { data: { product }, size: 'lg' })
      .closed.subscribe((saved) => {
        if (saved) this.products.reload();
      });
  }

  protected openHistory(product: Product): void {
    this.dialogs.open(PriceHistoryDialog, { data: product, size: 'lg' });
  }

  protected async toggleActive(product: Product): Promise<void> {
    if (product.active) {
      const ok = await this.confirm.ask({
        heading: '¿Desactivar producto?',
        message: `"${product.name}" dejará de aparecer en caja y en entradas. Su historial se conserva.`,
        confirmText: 'Desactivar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await this.api.updateProduct(product.id, { active: !product.active });
      this.toast.success(product.active ? 'Producto desactivado' : 'Producto reactivado');
      this.products.reload();
    } catch (error) {
      this.toast.error(toApiError(error).message);
    }
  }
}
