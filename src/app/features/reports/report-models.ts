import type { Unit } from '../../shared/utils/qty';
import type { PaymentMethod } from '../pos/pos-models';

/** Contratos de `/api/v1/reports/*` (montos en centavos, cantidades en unidad base). */

export type Granularity = 'day' | 'week' | 'month' | 'year';
export type TopSort = 'amount' | 'profit' | 'qty' | 'tickets';

export interface Totals {
  salesCents: number;
  costCents: number;
  profitCents: number;
  marginBp: number;
  taxCents: number;
  tickets: number;
  avgTicketCents: number;
  lines: number;
  cancelledCount: number;
  cancelledCents: number;
  purchasesCents: number;
}

export interface SummaryReport {
  from: string;
  to: string;
  totals: Totals;
  previous: { from: string; to: string; totals: Totals };
}

export interface SeriesPoint {
  period: string;
  salesCents: number;
  costCents: number;
  profitCents: number;
  tickets: number;
  avgTicketCents: number;
}

export interface SalesSeries {
  granularity: Granularity;
  points: SeriesPoint[];
}

export interface TopProduct {
  rank: number;
  productId: string;
  code: string;
  name: string;
  unit: Unit;
  qtyBase: number;
  salesCents: number;
  costCents: number;
  profitCents: number;
  marginBp: number;
  tickets: number;
  shareBp: number;
}

export interface TopProductsReport {
  sort: TopSort;
  totalSalesCents: number;
  items: TopProduct[];
}

export interface CategoryRow {
  categoryId: string | null;
  name: string;
  salesCents: number;
  costCents: number;
  profitCents: number;
  marginBp: number;
  tickets: number;
  shareBp: number;
}

export interface CategoriesReport {
  totalSalesCents: number;
  items: CategoryRow[];
}

export interface PaymentsReport {
  totalCents: number;
  byMethod: { method: PaymentMethod; amountCents: number; tickets: number; shareBp: number }[];
  byCashier: {
    cashierId: string;
    name: string;
    salesCents: number;
    tickets: number;
    avgTicketCents: number;
  }[];
  /** weekday ISO 1 = lunes … 7 = domingo; hour local 0–23. */
  hours: { weekday: number; hour: number; salesCents: number; tickets: number }[];
}

export interface PurchasesReport {
  granularity: Granularity;
  totalCents: number;
  count: number;
  points: { period: string; totalCents: number; count: number }[];
  bySupplier: {
    supplierId: string | null;
    name: string;
    totalCents: number;
    count: number;
    shareBp: number;
  }[];
  byProduct: {
    productId: string;
    code: string;
    name: string;
    unit: Unit;
    qtyBase: number;
    totalCents: number;
    avgUnitCostCents: number;
  }[];
}

export interface BusinessRow {
  businessId: string;
  name: string;
  active: boolean;
  salesCents: number;
  costCents: number;
  profitCents: number;
  marginBp: number;
  tickets: number;
  avgTicketCents: number;
  purchasesCents: number;
  shareBp: number;
}

export interface BusinessesReport {
  totalSalesCents: number;
  items: BusinessRow[];
}

/** Filtros compartidos por todas las vistas de reportes. */
export interface ReportParams {
  from: string;
  to: string;
  granularity?: Granularity;
  categoryId?: string;
  productId?: string;
  cashierId?: string;
  method?: PaymentMethod;
}

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
};
