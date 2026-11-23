import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { type Page, toApiError, toPage } from '../../../core/api/api-types';
import { BusinessContext } from '../../../core/business/business-context';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { QtyPipe } from '../../../shared/pipes/qty-pipe';
import {
  PosAutocomplete,
  PosBadge,
  PosBusinessGate,
  PosButton,
  PosCellDef,
  PosInput,
  PosOptionDef,
  PosPageHeader,
  PosSelect,
  PosTable,
  type SelectOption,
  type TableColumn,
  ToastService,
} from '../../../shared/ui';
import { CatalogApi, cleanParams } from '../../catalog/catalog-api';
import type { Product } from '../../catalog/catalog-models';
import { InventoryApi } from '../inventory-api';
import {
  MOVEMENT_LABEL,
  type Movement,
  type MovementType,
  REASON_LABEL,
} from '../inventory-models';

@Component({
  selector: 'pos-movements-page',
  imports: [
    PosBusinessGate,
    PosPageHeader,
    PosAutocomplete,
    PosOptionDef,
    PosInput,
    PosSelect,
    PosButton,
    PosTable,
    PosCellDef,
    PosBadge,
    MoneyPipe,
    QtyPipe,
  ],
  templateUrl: './movements-page.html',
  styles: `
    .product-filter {
      display: flex;
      align-items: flex-end;
      gap: var(--space-2);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      height: var(--control-h-md);
      padding: 0 var(--space-2) 0 var(--space-3);
      border: 1px solid var(--brand);
      border-radius: var(--radius);
      background: var(--brand-softer);
      font-weight: 600;
      white-space: nowrap;
    }
    .chip-label {
      display: grid;
      gap: var(--space-1);
      font-size: var(--text-sm);
      font-weight: 600;
    }
    .qty-in {
      color: var(--success);
      font-weight: 600;
    }
    .qty-out {
      color: var(--danger-hover);
      font-weight: 600;
    }
    .option {
      display: flex;
      gap: var(--space-3);
    }
  `,
})
export class MovementsPage {
  /** `?producto=<id>` (desde Productos o Existencias). */
  readonly producto = input<string>();

  private readonly inventory = inject(InventoryApi);
  private readonly catalog = inject(CatalogApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly context = inject(BusinessContext);

  protected readonly movementLabel = MOVEMENT_LABEL;
  protected readonly reasonLabel = REASON_LABEL;
  protected readonly productSample: Product[] = [];

  /** Producto filtrado: del query param o elegido en el buscador. */
  protected readonly product = signal<Pick<Product, 'id' | 'code' | 'name'> | null>(null);
  protected readonly type = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly page = linkedSignal({
    source: () => [this.product()?.id, this.type(), this.from(), this.to(), this.context.scope()],
    computation: () => 1,
  });

  protected readonly typeOptions: SelectOption[] = [
    { value: '', label: 'Todos' },
    ...(Object.keys(MOVEMENT_LABEL) as MovementType[]).map((t) => ({
      value: t,
      label: MOVEMENT_LABEL[t].label,
    })),
  ];

  protected readonly searchProducts = (term: string) => this.catalog.searchProducts(term, 8);

  protected readonly movements = httpResource<Page<Movement>>(
    () =>
      this.context.scope()
        ? {
            url: this.inventory.movementsUrl,
            params: cleanParams({
              page: this.page(),
              limit: 25,
              productId: this.product()?.id,
              type: this.type(),
              from: this.from(),
              to: this.to(),
            }),
          }
        : undefined,
    { parse: (body) => toPage<Movement>(body) },
  );

  protected readonly rows = computed(() =>
    this.movements.hasValue() ? this.movements.value().items : [],
  );
  protected readonly meta = computed(() =>
    this.movements.hasValue() ? this.movements.value().meta : undefined,
  );

  protected readonly columns: TableColumn<Movement>[] = [
    { key: 'createdAt', header: 'Fecha', type: 'datetime', width: '11rem' },
    { key: 'product', header: 'Producto' },
    { key: 'type', header: 'Movimiento', width: '12rem' },
    { key: 'qtyBase', header: 'Cantidad', align: 'end', width: '9rem' },
    { key: 'stockAfter', header: 'Queda', align: 'end', width: '9rem' },
    { key: 'unitCostCents', header: 'Costo', align: 'end', width: '8rem', hideOnMobile: true },
    { key: 'userName', header: 'Usuario', hideOnMobile: true },
  ];

  constructor() {
    // Producto del query param: se resuelve su nombre para mostrarlo en el filtro.
    effect(() => {
      const id = this.producto();
      if (id && this.context.scope() && this.product()?.id !== id) {
        this.product.set({ id, code: '', name: 'Cargando…' });
        this.inventory
          .getProduct(id)
          .then((p) => this.product.set({ id: p.id, code: p.code, name: p.name }))
          .catch(() => this.product.set(null));
      }
    });
    effect(() => {
      const error = this.movements.error();
      if (error) this.toast.error(toApiError(error).message);
    });
  }

  protected selectProduct(product: Product): void {
    this.product.set({ id: product.id, code: product.code, name: product.name });
    void this.router.navigate([], { queryParams: { producto: product.id }, replaceUrl: true });
  }

  protected clearProduct(): void {
    this.product.set(null);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }
}
