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
import type { Category } from '../catalog-models';
import { type CategoryFormData, CategoryFormDialog } from './category-form-dialog';

@Component({
  selector: 'pos-categories-page',
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
    <pos-page-header
      heading="Categorías"
      description="Grupos de productos: mariscos, pescados, bebidas…"
    >
      <button
        posButton
        icon="plus"
        headerActions
        [disabled]="!context.scope()"
        (click)="openForm()"
      >
        Nueva categoría
      </button>
    </pos-page-header>

    <pos-business-gate>
      <div class="pos-filters">
        <pos-input class="grow" label="Buscar" icon="search" type="search" [(value)]="searchText" />
        <pos-select label="Estado" [options]="statusOptions" [(value)]="status" />
      </div>

      <pos-table
        caption="Categorías"
        [columns]="columns"
        [rows]="rows()"
        [loading]="categories.isLoading()"
        [page]="meta()"
        (pageChange)="page.set($event)"
        emptyIcon="tags"
        emptyTitle="Sin categorías"
        emptyMessage="Crea categorías para ordenar tus productos."
      >
        <ng-template posCell="status" [posCellOf]="rows()" let-category>
          <pos-badge [tone]="category.active ? 'success' : 'neutral'">
            {{ category.active ? 'Activa' : 'Inactiva' }}
          </pos-badge>
        </ng-template>
        <ng-template posCell="actions" [posCellOf]="rows()" let-category>
          <span class="row-actions">
            <button
              posButton
              variant="ghost"
              size="sm"
              icon="pencil"
              iconOnly
              [attr.aria-label]="'Editar ' + category.name"
              (click)="openForm(category)"
            ></button>
            <button
              posButton
              variant="ghost"
              size="sm"
              [icon]="category.active ? 'power' : 'refresh'"
              iconOnly
              [attr.aria-label]="(category.active ? 'Desactivar ' : 'Reactivar ') + category.name"
              (click)="toggleActive(category)"
            ></button>
          </span>
        </ng-template>
      </pos-table>
    </pos-business-gate>
  `,
})
export class CategoriesPage {
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
    { value: '', label: 'Todas' },
    { value: 'true', label: 'Activas' },
    { value: 'false', label: 'Inactivas' },
  ];

  protected readonly categories = httpResource<Page<Category>>(
    () =>
      this.context.scope()
        ? {
            url: this.api.categoriesUrl,
            params: cleanParams({
              page: this.page(),
              limit: 20,
              search: this.search().trim(),
              active: this.status(),
            }),
          }
        : undefined,
    { parse: (body) => toPage<Category>(body) },
  );

  protected readonly rows = computed(() =>
    this.categories.hasValue() ? this.categories.value().items : [],
  );
  protected readonly meta = computed(() =>
    this.categories.hasValue() ? this.categories.value().meta : undefined,
  );

  protected readonly columns: TableColumn<Category>[] = [
    { key: 'name', header: 'Categoría', sortable: true },
    { key: 'createdAt', header: 'Alta', type: 'date', width: '10rem', hideOnMobile: true },
    { key: 'status', header: 'Estado', width: '8rem' },
    { key: 'actions', header: '', align: 'end', width: '6.5rem' },
  ];

  constructor() {
    effect(() => {
      const error = this.categories.error();
      if (error) this.toast.error(toApiError(error).message);
    });
  }

  protected openForm(category?: Category): void {
    this.dialogs
      .open<Category, CategoryFormData>(CategoryFormDialog, { data: { category }, size: 'sm' })
      .closed.subscribe((saved) => {
        if (saved) this.refresh();
      });
  }

  protected async toggleActive(category: Category): Promise<void> {
    if (category.active) {
      const ok = await this.confirm.ask({
        heading: '¿Desactivar categoría?',
        message: `"${category.name}" ya no aparecerá al dar de alta productos. Los productos que la usan no cambian.`,
        confirmText: 'Desactivar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await this.api.updateCategory(category.id, { active: !category.active });
      this.toast.success(category.active ? 'Categoría desactivada' : 'Categoría reactivada');
      this.refresh();
    } catch (error) {
      this.toast.error(toApiError(error).message);
    }
  }

  private refresh(): void {
    this.categories.reload();
    this.lookups.refresh();
  }
}
