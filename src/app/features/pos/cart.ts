import { Injectable, computed, inject, signal } from '@angular/core';
import { includedTaxCents, lineTotalCents } from '../../shared/utils/money';
import { unitScale } from '../../shared/utils/qty';
import { PosCatalog } from './pos-catalog';
import type { PosProduct } from './pos-models';

export interface CartEntry {
  key: number;
  productId: string;
  qtyBase: number;
  weighed: boolean;
}

export interface CartLine extends CartEntry {
  /** null si el producto ya no está a la venta (se desactivó mientras tanto). */
  product: PosProduct | null;
  lineTotalCents: number;
  taxCents: number;
}

/**
 * Ticket en curso. Guarda solo producto + cantidad: el precio sale SIEMPRE del catálogo vigente,
 * igual que en el servidor, así el total mostrado es el que se cobra.
 * Se provee a nivel de la pantalla de venta.
 */
@Injectable()
export class Cart {
  private readonly catalog = inject(PosCatalog);
  private nextKey = 0;
  private readonly entries = signal<readonly CartEntry[]>([]);
  /** Último renglón agregado/modificado (para resaltarlo y hacer scroll). */
  readonly lastKey = signal<number | null>(null);

  readonly lines = computed<CartLine[]>(() =>
    this.entries().map((entry) => {
      const product = this.catalog.get(entry.productId) ?? null;
      const total = product
        ? lineTotalCents(product.salePriceCents, entry.qtyBase, unitScale(product.unit))
        : 0;
      return {
        ...entry,
        product,
        lineTotalCents: total,
        taxCents: product ? includedTaxCents(total, product.taxRateBp) : 0,
      };
    }),
  );

  readonly totalCents = computed(() => this.lines().reduce((s, l) => s + l.lineTotalCents, 0));
  readonly taxCents = computed(() => this.lines().reduce((s, l) => s + l.taxCents, 0));
  readonly count = computed(() => this.entries().length);
  readonly isEmpty = computed(() => this.entries().length === 0);
  readonly hasUnavailable = computed(() => this.lines().some((l) => !l.product));

  /** Piezas se acumulan en el mismo renglón; cada pesada es un renglón nuevo. */
  add(product: PosProduct, qtyBase: number, weighed = false): void {
    if (qtyBase <= 0) return;
    if (product.unit === 'pz') {
      const existing = this.entries().find((e) => e.productId === product.id);
      if (existing) {
        this.setQty(existing.key, existing.qtyBase + qtyBase);
        return;
      }
    }
    const key = ++this.nextKey;
    this.entries.update((list) => [...list, { key, productId: product.id, qtyBase, weighed }]);
    this.lastKey.set(key);
  }

  setQty(key: number, qtyBase: number, weighed?: boolean): void {
    if (qtyBase <= 0) {
      this.remove(key);
      return;
    }
    this.entries.update((list) =>
      list.map((e) => (e.key === key ? { ...e, qtyBase, weighed: weighed ?? e.weighed } : e)),
    );
    this.lastKey.set(key);
  }

  remove(key: number): void {
    this.entries.update((list) => list.filter((e) => e.key !== key));
  }

  clear(): void {
    this.entries.set([]);
    this.lastKey.set(null);
  }

  /** Renglones para mandar al servidor. */
  toSaleItems() {
    return this.entries().map((e) => ({
      productId: e.productId,
      qtyBase: e.qtyBase,
      weighed: e.weighed,
    }));
  }
}
