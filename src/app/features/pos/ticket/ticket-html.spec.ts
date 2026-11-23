import { describe, expect, it } from 'vitest';
import type { CashSession, Sale } from '../pos-models';
import { type TicketBusiness, cashCloseHtml, escapeHtml, saleTicketHtml } from './ticket-html';

const business: TicketBusiness = {
  name: 'Mariscos <El Faro>',
  legalName: 'Mariscos El Faro SA de CV',
  taxId: 'MEF010101AAA',
  phone: '33 1234 5678',
  address: 'Av. del Mar 123',
  ticket: { header: 'Sucursal Centro\nAbierto 8-18 h', footer: '' },
};

const sale: Sale = {
  id: 's1',
  folio: 12,
  cashSessionId: 'c1',
  cashierId: 'u1',
  cashierName: 'Carlos & Co',
  items: [
    {
      productId: 'p1',
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
      productId: 'p2',
      code: '402',
      name: 'Cerveza <script>alert(1)</script>',
      unit: 'pz',
      qtyBase: 3,
      unitPriceCents: 3200,
      lineTotalCents: 9600,
      taxRateBp: 1600,
      taxCents: 1324,
      weighed: false,
    },
  ],
  totalCents: 58225,
  taxCents: 1324,
  payments: [{ method: 'cash', amountCents: 58225 }],
  cashReceivedCents: 60000,
  changeCents: 1775,
  status: 'completed',
  cancelledAt: null,
  cancelledByName: '',
  cancelReason: '',
  createdAt: '2026-11-22T22:46:00.000Z',
};

/** Texto del ticket; los elementos vecinos se separan con un espacio (en papel van en columnas). */
const text = (html: string) =>
  new DOMParser()
    .parseFromString(html.replace(/></g, '> <'), 'text/html')
    .body.textContent?.replace(/\s+/g, ' ') ?? '';

describe('saleTicketHtml', () => {
  it('trae negocio, folio, renglones, totales, pago y cambio', () => {
    const t = text(saleTicketHtml(sale, business, { widthMm: 80 }));
    for (const expected of [
      'Mariscos <El Faro>',
      'RFC: MEF010101AAA',
      'Tel. 33 1234 5678',
      'Sucursal Centro',
      'V-000012',
      'Atendió Carlos & Co',
      'Camarón grande U-15',
      '1.250 kg × $389.00',
      '$486.25',
      '3 pz × $32.00',
      'TOTAL $582.25',
      'IVA incluido $13.24',
      'Efectivo $582.25',
      'Recibido $600.00',
      'Cambio $17.75',
      '2 renglones',
      '¡Gracias por su compra!',
    ]) {
      expect(t).toContain(expected);
    }
  });

  it('escapa los textos: un nombre con HTML no se interpreta', () => {
    const html = saleTicketHtml(sale, business, { widthMm: 80 });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Mariscos &lt;El Faro&gt;');
  });

  it('ancho de papel 58 u 80 mm', () => {
    expect(saleTicketHtml(sale, business, { widthMm: 58 })).toContain('size: 58mm auto');
    expect(saleTicketHtml(sale, business, { widthMm: 80 })).toContain('width: 80mm');
  });

  it('reimpresión, venta cancelada y pie personalizado', () => {
    const t = text(
      saleTicketHtml(
        { ...sale, status: 'cancelled' },
        { ...business, ticket: { header: '', footer: 'Vuelva pronto' } },
        { widthMm: 80, copyLabel: 'REIMPRESIÓN' },
      ),
    );
    expect(t).toContain('REIMPRESIÓN');
    expect(t).toContain('VENTA CANCELADA');
    expect(t).toContain('Vuelva pronto');
    expect(t).not.toContain('Gracias por su compra');
  });
});

describe('cashCloseHtml', () => {
  const session: CashSession = {
    id: 'c1',
    folio: 3,
    userId: 'u1',
    userName: 'Carlos',
    status: 'closed',
    openedAt: '2026-11-22T14:00:00.000Z',
    openingFloatCents: 50000,
    movements: [
      { type: 'in', amountCents: 5000, reason: 'Cambio extra', userName: 'Carlos', at: '' },
      { type: 'out', amountCents: 10000, reason: 'Pago de hielo', userName: 'Carlos', at: '' },
    ],
    notes: 'Faltó cambio',
    closedAt: '2026-11-22T23:00:00.000Z',
    closedByName: 'Carlos',
    countedCashCents: 53000,
    expectedCashCents: 54600,
    differenceCents: -1600,
    salesCount: 2,
    salesTotalCents: 12100,
    cancelledCount: 1,
    byMethod: { cash: 9600, card: 2500, transfer: 0, other: 0 },
  };

  it('cuadre, contado, diferencia, ventas por forma de pago y movimientos', () => {
    const t = text(cashCloseHtml(session, business, { widthMm: 80 }));
    for (const expected of [
      'CORTE DE CAJA',
      'Turno C-000003',
      'Fondo inicial $500.00',
      'Ventas en efectivo +$96.00',
      'Entradas +$50.00',
      'Retiros −$100.00',
      'Efectivo esperado $546.00',
      'Efectivo contado $530.00',
      'Diferencia (Faltante) -$16.00',
      'Tarjeta $25.00',
      'Total vendido $121.00',
      'Cancelados 1',
      'Retiro: Pago de hielo',
      'Faltó cambio',
      'Entregó',
    ]) {
      expect(t).toContain(expected);
    }
  });

  it('turno abierto: corte parcial sin contado', () => {
    const t = text(
      cashCloseHtml(
        {
          ...session,
          status: 'open',
          closedAt: null,
          countedCashCents: null,
          differenceCents: null,
        },
        business,
        { widthMm: 58 },
      ),
    );
    expect(t).toContain('CORTE PARCIAL');
    expect(t).not.toContain('Efectivo contado');
  });
});

describe('escapeHtml', () => {
  it('escapa los cinco caracteres especiales', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});
