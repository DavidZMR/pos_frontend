import type { BadgeTone } from '../../shared/ui';
import type { Unit } from '../../shared/utils/qty';

export interface InventorySummary {
  products: number;
  inventoryValueCents: number;
  lowStock: number;
  outOfStock: number;
  negativeStock: number;
}

export type MovementType =
  'initial' | 'purchase' | 'purchase_cancel' | 'adjustment' | 'sale' | 'sale_cancel';

export type AdjustmentReason = 'merma' | 'conteo' | 'otro';

export interface Movement {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unit: Unit;
  type: MovementType;
  qtyBase: number;
  stockBefore: number;
  stockAfter: number;
  unitCostCents: number;
  reason: AdjustmentReason | null;
  note: string;
  refFolio: string;
  userName: string;
  createdAt: string;
}

export const MOVEMENT_LABEL: Record<MovementType, { label: string; tone: BadgeTone }> = {
  initial: { label: 'Inicial', tone: 'neutral' },
  purchase: { label: 'Entrada', tone: 'success' },
  purchase_cancel: { label: 'Entrada cancelada', tone: 'danger' },
  adjustment: { label: 'Ajuste', tone: 'warning' },
  sale: { label: 'Venta', tone: 'brand' },
  sale_cancel: { label: 'Venta cancelada', tone: 'danger' },
};

export const REASON_LABEL: Record<AdjustmentReason, string> = {
  merma: 'Merma',
  conteo: 'Conteo físico',
  otro: 'Otro',
};

export interface PurchaseItem {
  productId: string;
  code: string;
  name: string;
  unit: Unit;
  qtyBase: number;
  unitCostCents: number;
  lineTotalCents: number;
  previousCostCents: number;
  previousSalePriceCents: number;
  newSalePriceCents: number | null;
}

export interface Purchase {
  id: string;
  folio: number;
  supplierId: string | null;
  supplierName: string;
  invoiceNumber: string;
  notes: string;
  purchasedAt: string;
  items: PurchaseItem[];
  totalCents: number;
  status: 'active' | 'cancelled';
  createdByName: string;
  cancelledAt: string | null;
  cancelledByName: string;
  cancelReason: string;
  createdAt: string;
}

/** 12 → "E-000012" (mismo formato que el backend). */
export function purchaseFolio(folio: number): string {
  return `E-${String(folio).padStart(6, '0')}`;
}
