import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { type Page, toApiError, toPage } from '../../../core/api/api-types';
import { AuthStore } from '../../../core/auth/auth-store';
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
import { PosApi } from '../pos-api';
import { PAYMENT_LABEL, PAYMENT_METHODS, type Sale, saleFolio } from '../pos-models';
import { SaleDetailDialog } from './sale-detail-dialog';

@Component({
  selector: 'pos-sales-page',
  imports: [
    PosBusinessGate,
    PosPageHeader,
    PosInput,
    PosSelect,
    PosTable,
    PosCellDef,
    PosBadge,
    PosButton,
    MoneyPipe,
  ],
  template: `
    <pos-page-header
      eyebrow="Operación"
      heading="Ventas"
      [description]="
        isManager()
          ? 'Todos los tickets del negocio. Puedes cancelar una venta y la mercancía regresa al inventario.'
          : 'Tus tickets. Para cancelar una venta pide ayuda al administrador.'
      "
    />

    <pos-business-gate>
      <div class="pos-filters">
        <pos-input
          class="grow"
          label="Folio"
          icon="search"
          type="search"
          placeholder="V-000012 o 12"
          [(value)]="searchText"
        />
        <pos-input label="Desde" type="date" [(value)]="from" />
        <pos-input label="Hasta" type="date" [(value)]="to" />
        <pos-select label="Forma de pago" [options]="methodOptions" [(value)]="method" />
        <pos-select label="Estado" [options]="statusOptions" [(value)]="status" />
      </div>

      <pos-table
        caption="Ventas"
        [columns]="columns()"
        [rows]="rows()"
        [loading]="sales.isLoading()"
        [page]="meta()"
        (pageChange)="page.set($event)"
        emptyIcon="receipt"
        emptyTitle="Sin ventas"
        emptyMessage="No hay ventas con estos filtros."
      >
        <ng-template posCell="folio" [posCellOf]="rows()" let-sale>
          <span class="num code">{{ folioOf(sale) }}</span>
        </ng-template>
        <ng-template posCell="items" [posCellOf]="rows()" let-sale>
          <span class="num">{{ sale.items.length }}</span>
        </ng-template>
        <ng-template posCell="payments" [posCellOf]="rows()" let-sale>
          <span class="methods">
            @for (p of sale.payments; track p.method) {
              <pos-badge tone="brand">{{ labels[p.method].label }}</pos-badge>
            }
          </span>
        </ng-template>
        <ng-template posCell="totalCents" [posCellOf]="rows()" let-sale>
          <span class="num" [class.struck]="sale.status === 'cancelled'">
            <strong>{{ sale.totalCents | money }}</strong>
          </span>
        </ng-template>
        <ng-template posCell="status" [posCellOf]="rows()" let-sale>
          <pos-badge [tone]="sale.status === 'completed' ? 'success' : 'danger'">
            {{ sale.status === 'completed' ? 'Vigente' : 'Cancelada' }}
          </pos-badge>
        </ng-template>
        <ng-template posCell="actions" [posCellOf]="rows()" let-sale>
          <span class="row-actions">
            <button
              posButton
              variant="ghost"
              size="sm"
              icon="eye"
              iconOnly
              [attr.aria-label]="'Ver venta ' + folioOf(sale)"
              (click)="open(sale)"
            ></button>
          </span>
        </ng-template>
      </pos-table>
    </pos-business-gate>
  `,
  styles: `
    .methods {
      display: inline-flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }
    .struck {
      text-decoration: line-through;
      color: var(--ink-muted);
    }
  `,
})
export class SalesPage {
  private readonly api = inject(PosApi);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  protected readonly context = inject(BusinessContext);

  protected readonly labels = PAYMENT_LABEL;
  protected readonly isManager = computed(() => this.auth.hasRole('admin', 'superadmin'));

  protected readonly searchText = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly method = signal('');
  protected readonly status = signal('');
  private readonly search = debounced(this.searchText);
  protected readonly page = linkedSignal({
    source: () => [
      this.search(),
      this.from(),
      this.to(),
      this.method(),
      this.status(),
      this.context.scope(),
    ],
    computation: () => 1,
  });

  protected readonly methodOptions: SelectOption[] = [
    { value: '', label: 'Todas' },
    ...PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_LABEL[m].label })),
  ];
  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'Todas' },
    { value: 'completed', label: 'Vigentes' },
    { value: 'cancelled', label: 'Canceladas' },
  ];

  protected readonly sales = httpResource<Page<Sale>>(
    () =>
      this.context.scope()
        ? {
            url: this.api.salesUrl,
            params: cleanParams({
              page: this.page(),
              limit: 25,
              search: this.search().trim(),
              from: this.from(),
              to: this.to(),
              method: this.method(),
              status: this.status(),
            }),
          }
        : undefined,
    { parse: (body) => toPage<Sale>(body) },
  );

  protected readonly rows = computed(() => (this.sales.hasValue() ? this.sales.value().items : []));
  protected readonly meta = computed(() =>
    this.sales.hasValue() ? this.sales.value().meta : undefined,
  );

  protected readonly columns = computed<TableColumn<Sale>[]>(() => [
    { key: 'folio', header: 'Folio', width: '8rem' },
    { key: 'createdAt', header: 'Fecha', type: 'datetime', width: '11rem' },
    ...(this.isManager()
      ? [{ key: 'cashierName', header: 'Cajero', hideOnMobile: true } as TableColumn<Sale>]
      : []),
    { key: 'items', header: 'Renglones', align: 'end', width: '7rem', hideOnMobile: true },
    { key: 'payments', header: 'Forma de pago', hideOnMobile: true },
    { key: 'totalCents', header: 'Total', align: 'end', width: '9rem' },
    { key: 'status', header: 'Estado', width: '8rem', hideOnMobile: true },
    { key: 'actions', header: '', align: 'end', width: '4rem' },
  ]);

  protected readonly folioOf = (sale: Sale) => saleFolio(sale.folio);

  constructor() {
    effect(() => {
      const error = this.sales.error();
      if (error) this.toast.error(toApiError(error).message);
    });
  }

  protected open(sale: Sale): void {
    this.dialogs
      .open<boolean, Sale>(SaleDetailDialog, {
        data: sale,
        size: 'sm',
        autoFocus: 'first-tabbable',
      })
      .closed.subscribe(() => this.sales.reload());
  }
}
