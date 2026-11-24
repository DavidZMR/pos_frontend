import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { Totals } from '../report-models';
import { buildReportWorkbook, type ReportBundle } from './workbook-builder';

const totals = (overrides: Partial<Totals> = {}): Totals => ({
  salesCents: 1_234_550,
  costCents: 800_000,
  profitCents: 434_550,
  marginBp: 3520,
  taxCents: 12_000,
  tickets: 40,
  avgTicketCents: 30_864,
  lines: 90,
  cancelledCount: 1,
  cancelledCents: 5_000,
  purchasesCents: 600_000,
  ...overrides,
});

const bundle: ReportBundle = {
  summary: {
    from: '2026-03-01',
    to: '2026-03-03',
    totals: totals(),
    previous: { from: '2026-02-26', to: '2026-02-28', totals: totals({ salesCents: 1_000_000 }) },
  },
  series: {
    granularity: 'day',
    points: [
      {
        period: '2026-03-01',
        salesCents: 500_000,
        costCents: 300_000,
        profitCents: 200_000,
        tickets: 20,
        avgTicketCents: 25_000,
      },
      {
        period: '2026-03-02',
        salesCents: 0,
        costCents: 0,
        profitCents: 0,
        tickets: 0,
        avgTicketCents: 0,
      },
      {
        period: '2026-03-03',
        salesCents: 734_550,
        costCents: 500_000,
        profitCents: 234_550,
        tickets: 20,
        avgTicketCents: 36_728,
      },
    ],
  },
  top: {
    sort: 'amount',
    totalSalesCents: 1_234_550,
    items: [
      {
        rank: 1,
        productId: 'p1',
        code: '101',
        name: 'Camarón grande',
        unit: 'kg',
        qtyBase: 2_500,
        salesCents: 97_250,
        costCents: 72_500,
        profitCents: 24_750,
        marginBp: 2545,
        tickets: 3,
        shareBp: 788,
      },
    ],
  },
  categories: {
    totalSalesCents: 1_234_550,
    items: [
      {
        categoryId: 'c1',
        name: 'Mariscos',
        salesCents: 1_234_550,
        costCents: 800_000,
        profitCents: 434_550,
        marginBp: 3520,
        tickets: 40,
        shareBp: 10_000,
      },
    ],
  },
  payments: {
    totalCents: 1_234_550,
    byMethod: [
      { method: 'cash', amountCents: 1_000_000, tickets: 30, shareBp: 8100 },
      { method: 'card', amountCents: 234_550, tickets: 10, shareBp: 1900 },
      { method: 'transfer', amountCents: 0, tickets: 0, shareBp: 0 },
      { method: 'other', amountCents: 0, tickets: 0, shareBp: 0 },
    ],
    byCashier: [
      { cashierId: 'u1', name: 'Ana', salesCents: 1_234_550, tickets: 40, avgTicketCents: 30_864 },
    ],
    hours: [{ weekday: 7, hour: 14, salesCents: 300_000, tickets: 12 }],
  },
  purchases: {
    granularity: 'day',
    totalCents: 600_000,
    count: 2,
    points: [{ period: '2026-03-01', totalCents: 600_000, count: 2 }],
    bySupplier: [
      { supplierId: 's1', name: 'Pescadería', totalCents: 600_000, count: 2, shareBp: 10_000 },
    ],
    byProduct: [
      {
        productId: 'p1',
        code: '101',
        name: 'Camarón grande',
        unit: 'kg',
        qtyBase: 20_000,
        totalCents: 580_000,
        avgUnitCostCents: 29_000,
      },
    ],
  },
  businesses: null,
};

const meta = {
  businessName: 'El Atlántico',
  rangeText: '1 – 3 mar 2026',
  previousText: '26 – 28 feb 2026',
  filtersText: '',
  generatedAt: '3 mar 2026, 9:00 p.m.',
};

describe('buildReportWorkbook', () => {
  it('arma las hojas, con montos en pesos y formatos de moneda/porcentaje', async () => {
    const workbook = buildReportWorkbook(ExcelJS, bundle, meta);
    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      'Resumen',
      'Ventas por periodo',
      'Más vendidos',
      'Categorías',
      'Formas de pago',
      'Cajeros',
      'Horas',
      'Compras',
      'Compras por proveedor',
      'Productos comprados',
    ]);

    const summary = workbook.getWorksheet('Resumen');
    expect(summary?.getCell('A7').value).toBe('Ventas');
    expect(summary?.getCell('B7').value).toBe(12_345.5);
    expect(summary?.getCell('C7').value).toBe(10_000);
    expect(summary?.getCell('B7').numFmt).toBe('"$"#,##0.00');
    expect(summary?.getCell('D7').value).toEqual({ formula: 'IF(C7=0,"",(B7-C7)/ABS(C7))' });
    expect(summary?.getCell('B10').value).toBe(0.352); // margen como fracción con formato %

    const series = workbook.getWorksheet('Ventas por periodo');
    expect(series?.getCell('A5').value).toBe('1 mar');
    expect(series?.getCell('C5').value).toBe(5_000);
    expect(series?.getCell('C8').value).toEqual({ formula: 'SUM(C5:C7)' });
    expect(series?.autoFilter).toBeTruthy();

    const top = workbook.getWorksheet('Más vendidos');
    expect(top?.getCell('E5').value).toBe(2.5); // 2,500 g → 2.5 kg
    expect(top?.getCell('D5').value).toBe('kg');

    const hours = workbook.getWorksheet('Horas');
    // Domingo (fila 11) a las 14 h: la primera columna de horas es la de las 9.
    expect(hours?.getRow(11).getCell(2 + 14 - 9).value).toBe(12);

    // El archivo resultante se puede volver a abrir.
    const buffer = await workbook.xlsx.writeBuffer();
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buffer);
    expect(reloaded.getWorksheet('Resumen')?.getCell('A1').value).toBe(
      'Reporte de ventas · El Atlántico',
    );
  });

  it('agrega la comparativa de negocios solo cuando viene (superadmin, todos)', () => {
    const withBusinesses = buildReportWorkbook(
      ExcelJS,
      {
        ...bundle,
        businesses: {
          totalSalesCents: 100,
          items: [
            {
              businessId: 'b1',
              name: 'El Atlántico',
              active: true,
              salesCents: 100,
              costCents: 50,
              profitCents: 50,
              marginBp: 5000,
              tickets: 1,
              avgTicketCents: 100,
              purchasesCents: 0,
              shareBp: 10_000,
            },
          ],
        },
      },
      meta,
    );
    const sheet = withBusinesses.getWorksheet('Negocios');
    expect(sheet?.getCell('B5').value).toBe(1);
    // Fila de totales (6): margen y ticket promedio se calculan sobre los totales, no se suman.
    expect(sheet?.getCell('A6').value).toBe('Total');
    expect(sheet?.getCell('D6').value).toEqual({ formula: 'IF(B6=0,0,C6/B6)' });
    expect(sheet?.getCell('F6').value).toEqual({ formula: 'IF(E6=0,0,B6/E6)' });
  });

  it('las hojas de compras muestran solo los filtros que les aplican', () => {
    const workbook = buildReportWorkbook(ExcelJS, bundle, {
      ...meta,
      filtersText: 'categoría: Mariscos, pago: Efectivo',
      purchaseFiltersText: 'categoría: Mariscos, forma de pago: no aplican a compras',
    });
    const header = (name: string) => String(workbook.getWorksheet(name)?.getCell('A2').value);
    expect(header('Ventas por periodo')).toContain('pago: Efectivo');
    for (const name of ['Compras', 'Compras por proveedor', 'Productos comprados']) {
      expect(header(name), name).toContain('no aplican a compras');
      expect(header(name), name).not.toContain('pago: Efectivo');
    }
    // "Generado: … p.m." sin punto doble.
    expect(String(workbook.getWorksheet('Resumen')?.getCell('A4').value)).not.toContain('..');
  });
});
