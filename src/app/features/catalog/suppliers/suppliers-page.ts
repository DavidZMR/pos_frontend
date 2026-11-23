import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { type Page, toApiError, toPage } from '../../../core/api/api-types';
import { BusinessContext } from '../../../core/business/business-context';
import {
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
  ToastService,
} from '../../../shared/ui';
import { debounced } from '../../../shared/utils/debounced';
import { CatalogApi, cleanParams } from '../catalog-api';
import { CatalogLookups } from '../catalog-lookups';
import type { Supplier } from '../catalog-models';
import { type SupplierFormData, SupplierFormDialog } from './supplier-form-dialog';

@Component({
  selector: 'pos-suppliers-page',
  imports: [
    PosBusinessGate,
    PosPageHeader,
    PosButton,
    PosInput,
    PosSelect,
    PosTable,
    PosCellDef,
    PosBadge,
  ],
  template: `
    <pos-page-header heading="Proveedores" description="Quién te surte la mercancía.">
      <button
        posButton
        icon="plus"
        headerActions
        [disabled]="!context.scope()"
        (click)="openForm()"
      >
        Nuevo proveedor
      </button>
    </pos-page-header>

    <pos-business-gate>
      <div class="pos-filters">
        <pos-input class="grow" label="Buscar" icon="search" type="search" [(value)]="searchText" />
        <pos-select label="Estado" [options]="statusOptions" [(value)]="status" />
      </div>

      <pos-table
        caption="Proveedores"
        [columns]="columns"
        [rows]="rows()"
        [loading]="suppliers.isLoading()"
        [page]="meta()"
        (pageChange)="page.set($event)"
        emptyIcon="truck"
        emptyTitle="Sin proveedores"
        emptyMessage="Registra a quién le compras para llevar control de tus entradas."
      >
        <ng-template posCell="name" [posCellOf]="rows()" let-supplier>
          <span class="cell-stack">
            <span class="primary">{{ supplier.name }}</span>
            @if (supplier.contactName) {
              <span class="secondary">{{ supplier.contactName }}</span>
            }
          </span>
        </ng-template>
        <ng-template posCell="status" [posCellOf]="rows()" let-supplier>
          <pos-badge [tone]="supplier.active ? 'success' : 'neutral'">
            {{ supplier.active ? 'Activo' : 'Inactivo' }}
          </pos-badge>
        </ng-template>
        <ng-template posCell="actions" [posCellOf]="rows()" let-supplier>
          <span class="row-actions">
            <button
              posButton
              variant="ghost"
              size="sm"
              icon="pencil"
              iconOnly
              [attr.aria-label]="'Editar ' + supplier.name"
              (click)="openForm(supplier)"
            ></button>
            <button
              posButton
              variant="ghost"
              size="sm"
              [icon]="supplier.active ? 'power' : 'refresh'"
              iconOnly
              [attr.aria-label]="(supplier.active ? 'Desactivar ' : 'Reactivar ') + supplier.name"
              (click)="toggleActive(supplier)"
            ></button>
          </span>
        </ng-template>
      </pos-table>
    </pos-business-gate>
  `,
})
export class SuppliersPage {
  private readonly api = inject(CatalogApi);
  private readonly lookups = inject(CatalogLookups);
  private readonly dialogs = inject(DialogService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly context = inject(BusinessContext);

  protected readonly searchText = signal('');
  protected readonly status = signal('');
  private readonly search = debounced(this.searchText);
  protected readonly page = linkedSignal({
    source: () => [this.search(), this.status(), this.context.scope()],
    computation: () => 1,
  });

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'Todos' },
    { value: 'true', label: 'Activos' },
    { value: 'false', label: 'Inactivos' },
  ];

  protected readonly suppliers = httpResource<Page<Supplier>>(
    () =>
      this.context.scope()
        ? {
            url: this.api.suppliersUrl,
            params: cleanParams({
              page: this.page(),
              limit: 20,
              search: this.search().trim(),
              active: this.status(),
            }),
          }
        : undefined,
    { parse: (body) => toPage<Supplier>(body) },
  );

  protected readonly rows = computed(() =>
    this.suppliers.hasValue() ? this.suppliers.value().items : [],
  );
  protected readonly meta = computed(() =>
    this.suppliers.hasValue() ? this.suppliers.value().meta : undefined,
  );

  protected readonly columns: TableColumn<Supplier>[] = [
    { key: 'name', header: 'Proveedor', sortable: true },
    { key: 'phone', header: 'Teléfono', width: '10rem' },
    { key: 'email', header: 'Correo', hideOnMobile: true },
    { key: 'status', header: 'Estado', width: '8rem' },
    { key: 'actions', header: '', align: 'end', width: '6.5rem' },
  ];

  constructor() {
    effect(() => {
      const error = this.suppliers.error();
      if (error) this.toast.error(toApiError(error).message);
    });
  }

  protected openForm(supplier?: Supplier): void {
    this.dialogs
      .open<Supplier, SupplierFormData>(SupplierFormDialog, { data: { supplier } })
      .closed.subscribe((saved) => {
        if (saved) this.refresh();
      });
  }

  protected async toggleActive(supplier: Supplier): Promise<void> {
    if (supplier.active) {
      const ok = await this.confirm.ask({
        heading: '¿Desactivar proveedor?',
        message: `"${supplier.name}" ya no aparecerá al registrar entradas. Su historial se conserva.`,
        confirmText: 'Desactivar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await this.api.updateSupplier(supplier.id, { active: !supplier.active });
      this.toast.success(supplier.active ? 'Proveedor desactivado' : 'Proveedor reactivado');
      this.refresh();
    } catch (error) {
      this.toast.error(toApiError(error).message);
    }
  }

  private refresh(): void {
    this.suppliers.reload();
    this.lookups.refresh();
  }
}
