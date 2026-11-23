import { describe, expect, it } from 'vitest';
import { type CashSession, cashDifference, sessionTotals } from './pos-models';

function session(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: 's1',
    folio: 1,
    userId: 'u1',
    userName: 'Caja',
    status: 'closed',
    openedAt: '2026-11-20T15:00:00.000Z',
    openingFloatCents: 50000,
    movements: [
      { type: 'in', amountCents: 10000, reason: 'Cambio', userName: 'Caja', at: '' },
      { type: 'out', amountCents: 25000, reason: 'Hielo', userName: 'Caja', at: '' },
      { type: 'out', amountCents: 5000, reason: 'Bolsas', userName: 'Caja', at: '' },
    ],
    notes: '',
    closedAt: '2026-11-20T23:00:00.000Z',
    closedByName: 'Caja',
    countedCashCents: null,
    expectedCashCents: null,
    differenceCents: null,
    salesCount: 3,
    salesTotalCents: 120000,
    cancelledCount: 0,
    byMethod: { cash: 80000, card: 40000, transfer: 0, other: 0 },
    ...overrides,
  };
}

describe('cashDifference', () => {
  it('cuadra en cero, sobrante si sobra, faltante si falta', () => {
    expect(cashDifference(0)).toEqual({ label: 'Cuadra', tone: 'success' });
    expect(cashDifference(150)).toEqual({ label: 'Sobrante', tone: 'warning' });
    expect(cashDifference(-1)).toEqual({ label: 'Faltante', tone: 'danger' });
  });
});

describe('sessionTotals', () => {
  it('usa el resumen en vivo cuando el turno lo trae', () => {
    const summary = {
      salesCount: 9,
      salesTotalCents: 1,
      cancelledCount: 2,
      byMethod: { cash: 1, card: 0, transfer: 0, other: 0 },
      cashInCents: 0,
      cashOutCents: 0,
      expectedCashCents: 777,
    };
    expect(sessionTotals(session({ summary }))).toBe(summary);
  });

  it('suma entradas/retiros y calcula el esperado: fondo + efectivo + entradas − retiros', () => {
    const totals = sessionTotals(session());
    expect(totals.cashInCents).toBe(10000);
    expect(totals.cashOutCents).toBe(30000);
    expect(totals.expectedCashCents).toBe(50000 + 80000 + 10000 - 30000);
  });

  it('respeta el esperado congelado en el corte', () => {
    expect(sessionTotals(session({ expectedCashCents: 99999 })).expectedCashCents).toBe(99999);
  });
});
