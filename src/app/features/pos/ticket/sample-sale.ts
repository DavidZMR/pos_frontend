import type { Sale } from '../pos-models';

/** Venta de ejemplo para la impresión de prueba y la vista previa del ticket. */
export function sampleSale(cashierName: string): Sale {
  return {
    id: 'sample',
    folio: 123,
    cashSessionId: '',
    cashierId: '',
    cashierName,
    items: [
      {
        productId: 'a',
        code: '101',
        name: 'Camarón grande U-15',
        unit: 'kg',
        qtyBase: 1250,
        unitPriceCents: 38900,
        lineTotalCents: 48625,
        taxRateBp: 0,
        taxCents: 0,
        weighed: true,
      },
      {
        productId: 'b',
        code: '402',
        name: 'Cerveza clara 355 ml',
        unit: 'pz',
        qtyBase: 2,
        unitPriceCents: 3200,
        lineTotalCents: 6400,
        taxRateBp: 1600,
        taxCents: 883,
        weighed: false,
      },
    ],
    totalCents: 55025,
    taxCents: 883,
    payments: [{ method: 'cash', amountCents: 55025 }],
    cashReceivedCents: 60000,
    changeCents: 4975,
    status: 'completed',
    cancelledAt: null,
    cancelledByName: '',
    cancelReason: '',
    createdAt: new Date().toISOString(),
  };
}
