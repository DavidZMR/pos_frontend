import type { IconName } from '../../shared/ui';
import type { Unit } from '../../shared/utils/qty';

/** Producto del catálogo de caja (sin costos). */
export interface PosProduct {
  id: string;
  code: string;
  barcode?: string;
  name: string;
  categoryId: string | null;
  unit: Unit;
  salePriceCents: number;
  taxRateBp: number;
  stock: number;
  minStock: number;
}

export interface PosCategory {
  id: string;
  name: string;
}

export interface PosCatalogData {
  products: PosProduct[];
  categories: PosCategory[];
  loadedAt: string;
}

export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABEL: Record<PaymentMethod, { label: string; icon: IconName }> = {
  cash: { label: 'Efectivo', icon: 'wallet' },
  card: { label: 'Tarjeta', icon: 'receipt' },
  transfer: { label: 'Transferencia', icon: 'arrow-left-right' },
  other: { label: 'Otro', icon: 'ellipsis' },
};

export interface SessionSummary {
  salesCount: number;
  salesTotalCents: number;
  cancelledCount: number;
  byMethod: Record<PaymentMethod, number>;
  cashInCents: number;
  cashOutCents: number;
  expectedCashCents: number;
}

export interface CashMovement {
  type: 'in' | 'out';
  amountCents: number;
  reason: string;
  userName: string;
  at: string;
}

export interface CashSession {
  id: string;
  folio: number;
  userId: string;
  userName: string;
  status: 'open' | 'closed';
  openedAt: string;
  openingFloatCents: number;
  movements: CashMovement[];
  notes: string;
  closedAt: string | null;
  closedByName: string;
  countedCashCents: number | null;
  expectedCashCents: number | null;
  differenceCents: number | null;
  salesCount: number;
  salesTotalCents: number;
  cancelledCount: number;
  byMethod: Record<PaymentMethod, number>;
  summary?: SessionSummary;
}

export interface SaleItem {
  productId: string;
  code: string;
  name: string;
  unit: Unit;
  qtyBase: number;
  unitPriceCents: number;
  lineTotalCents: number;
  taxRateBp: number;
  taxCents: number;
  weighed: boolean;
}

export interface Sale {
  id: string;
  folio: number;
  cashSessionId: string;
  cashierId: string;
  cashierName: string;
  items: SaleItem[];
  totalCents: number;
  taxCents: number;
  payments: { method: PaymentMethod; amountCents: number }[];
  cashReceivedCents: number;
  changeCents: number;
  status: 'completed' | 'cancelled';
  cancelledAt: string | null;
  cancelledByName: string;
  cancelReason: string;
  createdAt: string;
}

/** Resultado del corte: contado − esperado. */
export function cashDifference(differenceCents: number): {
  label: string;
  tone: 'success' | 'warning' | 'danger';
} {
  if (differenceCents === 0) return { label: 'Cuadra', tone: 'success' };
  return differenceCents > 0
    ? { label: 'Sobrante', tone: 'warning' }
    : { label: 'Faltante', tone: 'danger' };
}

/** Totales del turno: en vivo (`summary`) si está abierto, congelados en el corte si está cerrado. */
export function sessionTotals(session: CashSession): SessionSummary {
  if (session.summary) return session.summary;
  const cashIn = session.movements
    .filter((m) => m.type === 'in')
    .reduce((sum, m) => sum + m.amountCents, 0);
  const cashOut = session.movements
    .filter((m) => m.type === 'out')
    .reduce((sum, m) => sum + m.amountCents, 0);
  return {
    salesCount: session.salesCount,
    salesTotalCents: session.salesTotalCents,
    cancelledCount: session.cancelledCount,
    byMethod: session.byMethod,
    cashInCents: cashIn,
    cashOutCents: cashOut,
    expectedCashCents:
      session.expectedCashCents ??
      session.openingFloatCents + session.byMethod.cash + cashIn - cashOut,
  };
}

export const saleFolio = (folio: number) => `V-${String(folio).padStart(6, '0')}`;
export const sessionFolio = (folio: number) => `C-${String(folio).padStart(6, '0')}`;
