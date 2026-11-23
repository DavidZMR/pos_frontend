import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type Page, toApiError, toPage } from '../../../core/api/api-types';
import { BusinessContext } from '../../../core/business/business-context';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import {
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
  ToastService,
} from '../../../shared/ui';
import { debounced } from '../../../shared/utils/debounced';
import { cleanParams } from '../../catalog/catalog-api';
import { CatalogLookups } from '../../catalog/catalog-lookups';
import { InventoryApi } from '../inventory-api';
import { type Purchase, purchaseFolio } from '../inventory-models';
import { PurchaseDetailDialog } from './purchase-detail-dialog';

@Component({
  selector: 'pos-purchases-page',
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
  ],
  template: `
    <pos-page-header
      eyebrow="Almacén"
      heading="Entradas de mercancía"
      description="Cada compra sube la existencia y actualiza el costo promedio."
    >
      <a posButton icon="plus" headerActions routerLink="/almacen/entradas/nueva">Nueva entrada</a>
    </pos-page-header>

    <pos-business-gate>
      <div class="pos-filters">
        <pos-input
          class="grow"
          label="Buscar"
          icon="search"
          type="search"
          placeholder="Folio (E-000012) o factura"
          [(value)]="searchText"
        />
        <pos-input label="Desde" type="date" [(value)]="from" />
        <pos-input label="Hasta" type="date" [(value)]="to" />
        <pos-select label="Proveedor" [options]="supplierFilterOptions()" [(value)]="supplierId" />
        <pos-select label="Estado" [options]="statusOptions" [(value)]="status" />
      </div>

      <pos-table
        caption="Entradas de mercancía"
        [columns]="columns"
        [rows]="rows()"
        [loading]="purchases.isLoading()"
        [page]="meta()"
        (pageChange)="page.set($event)"
        emptyIcon="truck"
        emptyTitle="Sin entradas"
        emptyMessage="Registra la mercancía que te llega para llevar existencias y costos."
      >
        <a posButton icon="plus" emptyActions routerLink="/almacen/entradas/nueva">Nueva entrada</a>

        <ng-template posCell="folio" [posCellOf]="rows()" let-purchase>
          <span class="num code">{{ folioOf(purchase) }}</span>
        </ng-template>
        <ng-template posCell="supplierName" [posCellOf]="rows()" let-purchase>
          <span class="cell-stack">
            <span class="primary">{{ purchase.supplierName || 'Sin proveedor' }}</span>
            @if (purchase.invoiceNumber) {
              <span class="secondary">Factura {{ purchase.invoiceNumber }}</span>
            }
          </span>
        </ng-template>
        <ng-template posCell="items" [posCellOf]="rows()" let-purchase>
          <span class="num">{{ purchase.items.length }}</span>
        </ng-template>
        <ng-template posCell="totalCents" [posCellOf]="rows()" let-purchase>
          <span class="num" [class.struck]="purchase.status === 'cancelled'">
            <strong>{{ purchase.totalCents | money }}</strong>
          </span>
        </ng-template>
        <ng-template posCell="status" [posCellOf]="rows()" let-purchase>
          <pos-badge [tone]="purchase.status === 'active' ? 'success' : 'danger'">
            {{ purchase.status === 'active' ? 'Vigente' : 'Cancelada' }}
          </pos-badge>
        </ng-template>
        <ng-template posCell="actions" [posCellOf]="rows()" let-purchase>
          <span class="row-actions">
            <button
              posButton
              variant="ghost"
              size="sm"
              icon="eye"
              iconOnly
              [attr.aria-label]="'Ver entrada ' + folioOf(purchase)"
              (click)="open(purchase)"
            ></button>
          </span>
        </ng-template>
      </pos-table>
    </pos-business-gate>
  `,
  styles: `
    .struck {
      text-decoration: line-through;
      color: var(--ink-muted);
    }
  `,
})
export class PurchasesPage {
  private readonly api = inject(InventoryApi);
  protected readonly lookups = inject(CatalogLookups);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  protected readonly context = inject(BusinessContext);

  protected readonly searchText = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly supplierId = signal('');
  protected readonly status = signal('');
  private readonly search = debounced(this.searchText);
  protected readonly page = linkedSignal({
    source: () => [
      this.search(),
      this.from(),
      this.to(),
      this.supplierId(),
      this.status(),
      this.context.scope(),
    ],
    computation: () => 1,
  });

  protected readonly supplierFilterOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Todos' },
    ...this.lookups.supplierOptions(),
  ]);
  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'Todas' },
    { value: 'active', label: 'Vigentes' },
    { value: 'cancelled', label: 'Canceladas' },
  ];

  protected readonly purchases = httpResource<Page<Purchase>>(
    () =>
      this.context.scope()
        ? {
            url: this.api.purchasesUrl,
            params: cleanParams({
              page: this.page(),
              limit: 20,
              search: this.search().trim(),
              from: this.from(),
              to: this.to(),
              supplierId: this.supplierId(),
              status: this.status(),
            }),
          }
        : undefined,
    { parse: (body) => toPage<Purchase>(body) },
  );

  protected readonly rows = computed(() =>
    this.purchases.hasValue() ? this.purchases.value().items : [],
  );
  protected readonly meta = computed(() =>
    this.purchases.hasValue() ? this.purchases.value().meta : undefined,
  );

  protected readonly columns: TableColumn<Purchase>[] = [
    { key: 'folio', header: 'Folio', width: '8rem' },
    { key: 'purchasedAt', header: 'Fecha', type: 'datetime', width: '11rem' },
    { key: 'supplierName', header: 'Proveedor' },
    { key: 'items', header: 'Productos', align: 'end', width: '7rem', hideOnMobile: true },
    { key: 'totalCents', header: 'Total', align: 'end', width: '9rem' },
    { key: 'status', header: 'Estado', width: '8rem', hideOnMobile: true },
    { key: 'actions', header: '', align: 'end', width: '4rem' },
  ];

  protected readonly folioOf = (purchase: Purchase) => purchaseFolio(purchase.folio);

  constructor() {
    effect(() => {
      const error = this.purchases.error();
      if (error) this.toast.error(toApiError(error).message);
    });
  }

  protected open(purchase: Purchase): void {
    // Se recarga al cerrar (aunque sea con Esc) por si se canceló dentro del detalle.
    this.dialogs
      .open<boolean, Purchase>(PurchaseDetailDialog, { data: purchase, size: 'lg' })
      .closed.subscribe(() => this.purchases.reload());
  }
}
