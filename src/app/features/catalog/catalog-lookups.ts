import { httpResource } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { type Page, toPage } from '../../core/api/api-types';
import { AuthStore } from '../../core/auth/auth-store';
import { BusinessContext } from '../../core/business/business-context';
import type { SelectOption } from '../../shared/ui';
import { CatalogApi } from './catalog-api';
import type { Category, Supplier } from './catalog-models';

/**
 * Listas pequeñas del negocio actual (categorías y proveedores) para selects y para
 * mostrar nombres en tablas. Se recargan solas al cambiar de negocio.
 */
@Service()
export class CatalogLookups {
  private readonly api = inject(CatalogApi);
  private readonly auth = inject(AuthStore);
  private readonly context = inject(BusinessContext);

  private readonly enabled = computed(
    () => this.auth.hasRole('admin', 'superadmin') && Boolean(this.context.scope()),
  );

  readonly categories = httpResource<Page<Category>>(
    () => (this.enabled() ? { url: this.api.categoriesUrl, params: { limit: 100 } } : undefined),
    { parse: (body) => toPage<Category>(body) },
  );

  readonly suppliers = httpResource<Page<Supplier>>(
    () => (this.enabled() ? { url: this.api.suppliersUrl, params: { limit: 100 } } : undefined),
    { parse: (body) => toPage<Supplier>(body) },
  );

  private readonly categoryList = computed(() =>
    this.categories.hasValue() ? this.categories.value().items : [],
  );
  private readonly supplierList = computed(() =>
    this.suppliers.hasValue() ? this.suppliers.value().items : [],
  );

  /** Categorías activas (+ la actual aunque esté inactiva, para no perderla al editar). */
  categoryOptions(currentId?: string | null): SelectOption[] {
    return this.categoryList()
      .filter((c) => c.active || c.id === currentId)
      .map((c) => ({ value: c.id, label: c.active ? c.name : `${c.name} (inactiva)` }));
  }

  supplierOptions(currentId?: string | null): SelectOption[] {
    return this.supplierList()
      .filter((s) => s.active || s.id === currentId)
      .map((s) => ({ value: s.id, label: s.active ? s.name : `${s.name} (inactivo)` }));
  }

  categoryName(id: string | null | undefined): string {
    if (!id) return '';
    return this.categoryList().find((c) => c.id === id)?.name ?? '';
  }

  refresh(): void {
    this.categories.reload();
    this.suppliers.reload();
  }
}
