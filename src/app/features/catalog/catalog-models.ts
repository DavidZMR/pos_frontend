import type { Unit } from '../../shared/utils/qty';

export interface Category {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
  createdAt: string;
}

export type TaxRateBp = 0 | 800 | 1600;

export interface Product {
  id: string;
  code: string;
  barcode?: string;
  name: string;
  categoryId: string | null;
  unit: Unit;
  /** Precio por unidad de venta, IVA incluido. */
  salePriceCents: number;
  /** Costo promedio por unidad de venta. */
  costCents: number;
  taxRateBp: TaxRateBp;
  /** Existencia en unidad base (pz, g, ml). */
  stock: number;
  minStock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PriceChange {
  id: string;
  salePriceCents: number;
  costCents: number;
  previousSalePriceCents: number | null;
  previousCostCents: number | null;
  source: 'create' | 'manual' | 'purchase';
  refFolio: string;
  userName: string;
  createdAt: string;
}

export const UNIT_OPTIONS = [
  { value: 'pz', label: 'Pieza (pz)' },
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'l', label: 'Litro (l)' },
];

export const TAX_OPTIONS = [
  { value: '1600', label: 'IVA 16 % (general)' },
  { value: '800', label: 'IVA 8 % (región fronteriza)' },
  { value: '0', label: 'Tasa 0 % / exento (alimentos sin preparar)' },
];

export type StockStatus = 'ok' | 'low' | 'out' | 'negative';

export function stockStatus(product: Pick<Product, 'stock' | 'minStock'>): StockStatus {
  if (product.stock < 0) return 'negative';
  if (product.stock === 0) return 'out';
  if (product.minStock > 0 && product.stock <= product.minStock) return 'low';
  return 'ok';
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  ok: 'Suficiente',
  low: 'Bajo mínimo',
  out: 'Agotado',
  negative: 'Negativo',
};
