import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type Page, toPage, unwrap } from '../../core/api/api-types';
import { ConfigService } from '../../core/config/config-service';
import type { Category, Product, Supplier, TaxRateBp } from './catalog-models';
import type { Unit } from '../../shared/utils/qty';

type Params = Record<string, string | number>;

/** Quita filtros vacíos para no mandarlos en la query. */
export function cleanParams(params: Record<string, string | number | boolean | undefined>): Params {
  const out: Params = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    out[key] = typeof value === 'boolean' ? String(value) : value;
  }
  return out;
}

export interface ProductInput {
  code: string;
  barcode?: string;
  name: string;
  categoryId?: string | null;
  unit: Unit;
  salePriceCents: number;
  costCents: number;
  taxRateBp: TaxRateBp;
  minStock: number;
  initialStock?: number;
  active?: boolean;
}

export interface SupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  active?: boolean;
}

/** Acceso al API de categorías, proveedores y productos. */
@Service()
export class CatalogApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  readonly categoriesUrl = this.config.api('/categories');
  readonly suppliersUrl = this.config.api('/suppliers');
  readonly productsUrl = this.config.api('/products');

  // ---- Categorías --------------------------------------------------------
  async createCategory(name: string): Promise<Category> {
    return unwrap(await firstValueFrom(this.http.post(this.categoriesUrl, { name })));
  }

  async updateCategory(id: string, input: { name?: string; active?: boolean }): Promise<Category> {
    return unwrap(await firstValueFrom(this.http.patch(`${this.categoriesUrl}/${id}`, input)));
  }

  // ---- Proveedores ------------------------------------------------------
  async createSupplier(input: SupplierInput): Promise<Supplier> {
    return unwrap(await firstValueFrom(this.http.post(this.suppliersUrl, input)));
  }

  async updateSupplier(id: string, input: Partial<SupplierInput>): Promise<Supplier> {
    return unwrap(await firstValueFrom(this.http.patch(`${this.suppliersUrl}/${id}`, input)));
  }

  // ---- Productos --------------------------------------------------------
  async createProduct(input: ProductInput): Promise<Product> {
    return unwrap(await firstValueFrom(this.http.post(this.productsUrl, input)));
  }

  async updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
    return unwrap(await firstValueFrom(this.http.patch(`${this.productsUrl}/${id}`, input)));
  }

  async nextCode(): Promise<string> {
    const body = await firstValueFrom(this.http.get(`${this.productsUrl}/next-code`));
    return unwrap<{ code: string }>(body).code;
  }

  /** Búsqueda rápida (autocompletado): por código, código de barras o nombre. */
  async searchProducts(search: string, limit = 8): Promise<Product[]> {
    const body = await firstValueFrom(
      this.http.get(this.productsUrl, { params: { search, limit, active: 'true' } }),
    );
    return toPage<Product>(body).items;
  }

  async listProducts(params: Params): Promise<Page<Product>> {
    return toPage<Product>(await firstValueFrom(this.http.get(this.productsUrl, { params })));
  }
}
