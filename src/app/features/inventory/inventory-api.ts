import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { unwrap } from '../../core/api/api-types';
import { ConfigService } from '../../core/config/config-service';
import type { Product } from '../catalog/catalog-models';
import type { AdjustmentReason, Movement, Purchase } from './inventory-models';

export interface PurchaseLineInput {
  productId: string;
  qtyBase: number;
  unitCostCents: number;
  newSalePriceCents?: number;
}

export interface CreatePurchaseInput {
  supplierId?: string | null;
  invoiceNumber?: string;
  notes?: string;
  purchaseDate?: string;
  items: PurchaseLineInput[];
}

export interface AdjustmentInput {
  productId: string;
  mode: 'remove' | 'add' | 'set';
  qtyBase: number;
  reason: AdjustmentReason;
  note?: string;
}

/** Entradas de mercancía, ajustes y kárdex. */
@Service()
export class InventoryApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  readonly purchasesUrl = this.config.api('/purchases');
  readonly summaryUrl = this.config.api('/inventory/summary');
  readonly movementsUrl = this.config.api('/inventory/movements');
  private readonly adjustmentsUrl = this.config.api('/inventory/adjustments');
  private readonly productsUrl = this.config.api('/products');

  async createPurchase(
    input: CreatePurchaseInput,
  ): Promise<{ purchase: Purchase; message: string }> {
    const body = await firstValueFrom(this.http.post(this.purchasesUrl, input));
    return {
      purchase: unwrap<Purchase>(body),
      message: (body as { message?: string }).message ?? '',
    };
  }

  async getPurchase(id: string): Promise<Purchase> {
    return unwrap(await firstValueFrom(this.http.get(`${this.purchasesUrl}/${id}`)));
  }

  async cancelPurchase(id: string, reason: string): Promise<Purchase> {
    return unwrap(
      await firstValueFrom(this.http.post(`${this.purchasesUrl}/${id}/cancel`, { reason })),
    );
  }

  async adjust(input: AdjustmentInput): Promise<{ movement: Movement; product: Product }> {
    return unwrap(await firstValueFrom(this.http.post(this.adjustmentsUrl, input)));
  }

  async getProduct(id: string): Promise<Product> {
    return unwrap(await firstValueFrom(this.http.get(`${this.productsUrl}/${id}`)));
  }
}
