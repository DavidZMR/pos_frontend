import { httpResource } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { unwrap } from '../../core/api/api-types';
import { BusinessContext } from '../../core/business/business-context';
import { indexProducts, searchCatalog } from './catalog-search';
import { PosApi } from './pos-api';
import type { PosCatalogData, PosProduct } from './pos-models';

/**
 * Catálogo activo del negocio en memoria para la caja: búsqueda instantánea sin ir al servidor.
 * Se recarga al cambiar de negocio y después de cada venta (existencias).
 */
@Service()
export class PosCatalog {
  private readonly api = inject(PosApi);
  private readonly context = inject(BusinessContext);

  readonly resource = httpResource<PosCatalogData>(
    () => (this.context.scope() ? this.api.catalogUrl : undefined),
    { parse: (body) => unwrap<PosCatalogData>(body) },
  );

  readonly products = computed(() =>
    this.resource.hasValue() ? this.resource.value().products : [],
  );
  readonly categories = computed(() =>
    this.resource.hasValue() ? this.resource.value().categories : [],
  );
  private readonly index = computed(() => indexProducts(this.products()));
  private readonly byId = computed(() => new Map(this.products().map((p) => [p.id, p])));

  search(term: string, limit = 40): PosProduct[] {
    return searchCatalog(this.index(), term, limit);
  }

  get(id: string): PosProduct | undefined {
    return this.byId().get(id);
  }

  inCategory(categoryId: string | null): PosProduct[] {
    const all = this.products();
    return categoryId ? all.filter((p) => p.categoryId === categoryId) : all;
  }

  reload(): void {
    this.resource.reload();
  }
}
