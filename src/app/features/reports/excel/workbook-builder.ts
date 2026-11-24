import type { Workbook, Worksheet } from 'exceljs';
import { UNITS, type Unit } from '../../../shared/utils/qty';
import { PAYMENT_LABEL } from '../../pos/pos-models';
import { periodLabel } from '../report-dates';
import type {
  BusinessesReport,
  CategoriesReport,
  PaymentsReport,
  PurchasesReport,
  SalesSeries,
  SummaryReport,
  TopProductsReport,
} from '../report-models';

/**
 * Libro de Excel "tipo dashboard" (función pura: recibe datos e imágenes ya generadas).
 * Los centavos se dividen entre 100 SOLO aquí, para mostrarse como moneda en Excel.
 */

export interface ReportBundle {
  summary: SummaryReport;
  series: SalesSeries;
  top: TopProductsReport;
  categories: CategoriesReport;
  payments: PaymentsReport;
  purchases: PurchasesReport;
  /** Solo superadmin con "todos los negocios". */
  businesses: BusinessesReport | null;
}

export interface ExportMeta {
  businessName: string;
  rangeText: string;
  previousText: string;
  filtersText: string;
  generatedAt: string;
}

/** PNG en base64 (data URL) por gráfica; las que falten simplemente no se insertan. */
export type ChartImages = Partial<Record<'trend' | 'top' | 'categories' | 'methods', string>>;

type ExcelModule = { Workbook: new () => Workbook };

const BRAND = 'FF145F86';
const BRAND_INK = 'FF0F4C6B';
const MUTED = 'FF4A6272';
const BAND = 'FFEEF7FB';
const MONEY = '"$"#,##0.00';
const PERCENT = '0.0%';
const INTEGER = '#,##0';
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const money = (cents: number) => cents / 100;
const ratio = (bp: number) => bp / 10_000;
const qty = (qtyBase: number, unit: Unit) => qtyBase / UNITS[unit].scale;

interface Column {
  header: string;
  width: number;
  format?: string;
  /** Fila de totales: SUM, o una fórmula propia con {r1} {rN} (primera/última fila de datos). */
  total?: 'sum' | string;
}

/** Hoja con tabla: encabezado de marca, autofiltro, paneles congelados y fila de totales. */
function tableSheet(
  workbook: Workbook,
  name: string,
  title: string,
  meta: ExportMeta,
  columns: Column[],
  rows: (string | number | Date | null)[][],
): Worksheet {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 4 }] });
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: BRAND_INK } };
  sheet.getCell('A2').value =
    `${meta.businessName} · ${meta.rangeText}${meta.filtersText ? ` · ${meta.filtersText}` : ''}`;
  sheet.getCell('A2').font = { color: { argb: MUTED } };

  const headerRow = sheet.getRow(4);
  columns.forEach((column, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: i === 0 ? 'left' : 'center',
      wrapText: true,
    };
    sheet.getColumn(i + 1).width = column.width;
  });
  headerRow.height = 22;

  rows.forEach((values, r) => {
    const row = sheet.getRow(5 + r);
    values.forEach((value, c) => {
      const cell = row.getCell(c + 1);
      cell.value = value;
      const format = columns[c]?.format;
      if (format) cell.numFmt = format;
    });
    if (r % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
      });
    }
  });

  const first = 5;
  const last = 4 + rows.length;
  if (rows.length) {
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: last, column: columns.length } };
    if (columns.some((c) => c.total)) {
      const totalRow = sheet.getRow(last + 1);
      totalRow.getCell(1).value = 'Total';
      columns.forEach((column, i) => {
        if (!column.total) return;
        const letter = sheet.getColumn(i + 1).letter;
        const formula =
          column.total === 'sum'
            ? `SUM(${letter}${first}:${letter}${last})`
            : column.total.replaceAll('{r1}', String(first)).replaceAll('{rN}', String(last + 1));
        const cell = totalRow.getCell(i + 1);
        cell.value = { formula };
        if (column.format) cell.numFmt = column.format;
      });
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.border = { top: { style: 'thin', color: { argb: BRAND } } };
      });
    }
  }
  return sheet;
}

export function buildReportWorkbook(
  excel: ExcelModule,
  data: ReportBundle,
  meta: ExportMeta,
  images: ChartImages = {},
): Workbook {
  const workbook = new excel.Workbook();
  workbook.creator = meta.businessName;
  workbook.created = new Date();

  // ---- Resumen (KPIs + gráficas) ---------------------------------------------------------
  const summary = workbook.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  summary.getColumn(1).width = 26;
  summary.getColumn(2).width = 18;
  summary.getColumn(3).width = 18;
  summary.getColumn(4).width = 12;
  summary.getCell('A1').value = `Reporte de ventas · ${meta.businessName}`;
  summary.getCell('A1').font = { bold: true, size: 18, color: { argb: BRAND_INK } };
  summary.getCell('A2').value = `Periodo: ${meta.rangeText} (comparado con ${meta.previousText})`;
  summary.getCell('A3').value = meta.filtersText
    ? `Filtros: ${meta.filtersText}`
    : 'Sin filtros adicionales';
  summary.getCell('A4').value =
    `Generado: ${meta.generatedAt}. Montos con el precio y costo de cada venta.`;
  for (const ref of ['A2', 'A3', 'A4']) summary.getCell(ref).font = { color: { argb: MUTED } };

  const t = data.summary.totals;
  const p = data.summary.previous.totals;
  const header = summary.getRow(6);
  ['Indicador', 'Periodo', 'Periodo anterior', 'Cambio'].forEach((text, i) => {
    const cell = header.getCell(i + 1);
    cell.value = text;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
  });
  const kpis: [string, number, number, string][] = [
    ['Ventas', money(t.salesCents), money(p.salesCents), MONEY],
    ['Costo de lo vendido', money(t.costCents), money(p.costCents), MONEY],
    ['Ganancia', money(t.profitCents), money(p.profitCents), MONEY],
    ['Margen', ratio(t.marginBp), ratio(p.marginBp), PERCENT],
    ['IVA incluido', money(t.taxCents), money(p.taxCents), MONEY],
    ['Tickets', t.tickets, p.tickets, INTEGER],
    ['Ticket promedio', money(t.avgTicketCents), money(p.avgTicketCents), MONEY],
    ['Compras', money(t.purchasesCents), money(p.purchasesCents), MONEY],
    ['Ventas canceladas', t.cancelledCount, p.cancelledCount, INTEGER],
    ['Importe cancelado', money(t.cancelledCents), money(p.cancelledCents), MONEY],
  ];
  kpis.forEach(([label, current, previous, format], i) => {
    const r = 7 + i;
    const row = summary.getRow(r);
    row.getCell(1).value = label;
    row.getCell(2).value = current;
    row.getCell(3).value = previous;
    row.getCell(2).numFmt = format;
    row.getCell(3).numFmt = format;
    // Cambio relativo como fórmula (se recalcula si alguien edita las cifras).
    row.getCell(4).value =
      format === PERCENT
        ? { formula: `B${r}-C${r}` }
        : { formula: `IF(C${r}=0,"",(B${r}-C${r})/ABS(C${r}))` };
    row.getCell(4).numFmt = PERCENT;
    row.getCell(1).font = { bold: label === 'Ventas' || label === 'Ganancia' };
    if (i % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
      });
    }
  });

  const placeImage = (
    key: keyof ChartImages,
    col: number,
    row: number,
    width: number,
    height: number,
  ) => {
    const base64 = images[key];
    if (!base64) return;
    const id = workbook.addImage({ base64, extension: 'png' });
    summary.addImage(id, { tl: { col, row }, ext: { width, height } });
  };
  placeImage('trend', 5, 1, 720, 300);
  placeImage('top', 5, 17, 720, 340);
  placeImage('methods', 0, 18, 380, 200);
  placeImage('categories', 0, 30, 380, 240);

  // ---- Ventas por periodo ------------------------------------------------------------------
  const g = data.series.granularity;
  tableSheet(
    workbook,
    'Ventas por periodo',
    'Ventas por periodo',
    meta,
    [
      { header: 'Periodo', width: 16 },
      { header: 'Inicio', width: 12, format: 'dd/mm/yyyy' },
      { header: 'Ventas', width: 16, format: MONEY, total: 'sum' },
      { header: 'Costo', width: 16, format: MONEY, total: 'sum' },
      { header: 'Ganancia', width: 16, format: MONEY, total: 'sum' },
      { header: 'Margen', width: 10, format: PERCENT, total: 'IF(C{rN}=0,0,E{rN}/C{rN})' },
      { header: 'Tickets', width: 10, format: INTEGER, total: 'sum' },
      { header: 'Ticket promedio', width: 16, format: MONEY, total: 'IF(G{rN}=0,0,C{rN}/G{rN})' },
    ],
    data.series.points.map((pt) => [
      periodLabel(pt.period, g),
      excelDate(pt.period),
      money(pt.salesCents),
      money(pt.costCents),
      money(pt.profitCents),
      pt.salesCents ? pt.profitCents / pt.salesCents : 0,
      pt.tickets,
      money(pt.avgTicketCents),
    ]),
  );

  // ---- Más vendidos ------------------------------------------------------------------------
  tableSheet(
    workbook,
    'Más vendidos',
    'Productos más vendidos (por importe)',
    meta,
    [
      { header: 'Lugar', width: 7 },
      { header: 'Código', width: 9 },
      { header: 'Producto', width: 34 },
      { header: 'Unidad', width: 8 },
      { header: 'Cantidad', width: 12, format: '#,##0.000' },
      { header: 'Ventas', width: 15, format: MONEY, total: 'sum' },
      { header: 'Costo', width: 15, format: MONEY, total: 'sum' },
      { header: 'Ganancia', width: 15, format: MONEY, total: 'sum' },
      { header: 'Margen', width: 10, format: PERCENT },
      { header: 'Tickets', width: 9, format: INTEGER },
      { header: '% de las ventas', width: 12, format: PERCENT },
    ],
    data.top.items.map((item) => [
      item.rank,
      item.code,
      item.name,
      UNITS[item.unit].label,
      qty(item.qtyBase, item.unit),
      money(item.salesCents),
      money(item.costCents),
      money(item.profitCents),
      ratio(item.marginBp),
      item.tickets,
      ratio(item.shareBp),
    ]),
  );

  // ---- Categorías ------------------------------------------------------------------------------
  tableSheet(
    workbook,
    'Categorías',
    'Ventas por categoría',
    meta,
    [
      { header: 'Categoría', width: 28 },
      { header: 'Ventas', width: 16, format: MONEY, total: 'sum' },
      { header: 'Costo', width: 16, format: MONEY, total: 'sum' },
      { header: 'Ganancia', width: 16, format: MONEY, total: 'sum' },
      { header: 'Margen', width: 10, format: PERCENT, total: 'IF(B{rN}=0,0,D{rN}/B{rN})' },
      { header: 'Tickets', width: 10, format: INTEGER },
      { header: '% de las ventas', width: 12, format: PERCENT },
    ],
    data.categories.items.map((c) => [
      c.name,
      money(c.salesCents),
      money(c.costCents),
      money(c.profitCents),
      ratio(c.marginBp),
      c.tickets,
      ratio(c.shareBp),
    ]),
  );

  // ---- Formas de pago y cajeros ------------------------------------------------------------------
  tableSheet(
    workbook,
    'Formas de pago',
    'Ventas por forma de pago',
    meta,
    [
      { header: 'Forma de pago', width: 18 },
      { header: 'Monto', width: 16, format: MONEY, total: 'sum' },
      { header: 'Tickets', width: 10, format: INTEGER, total: 'sum' },
      { header: '% del total', width: 12, format: PERCENT },
    ],
    data.payments.byMethod.map((m) => [
      PAYMENT_LABEL[m.method].label,
      money(m.amountCents),
      m.tickets,
      ratio(m.shareBp),
    ]),
  );
  tableSheet(
    workbook,
    'Cajeros',
    'Ventas por cajero',
    meta,
    [
      { header: 'Cajero', width: 26 },
      { header: 'Ventas', width: 16, format: MONEY, total: 'sum' },
      { header: 'Tickets', width: 10, format: INTEGER, total: 'sum' },
      { header: 'Ticket promedio', width: 16, format: MONEY },
    ],
    data.payments.byCashier.map((c) => [
      c.name,
      money(c.salesCents),
      c.tickets,
      money(c.avgTicketCents),
    ]),
  );

  // ---- Horas pico (matriz con escala de color) ------------------------------------------------
  const hoursUsed = data.payments.hours.map((h) => h.hour);
  const firstHour = Math.min(9, ...hoursUsed);
  const lastHour = Math.max(20, ...hoursUsed);
  const hourList = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const hoursSheet = tableSheet(
    workbook,
    'Horas',
    'Tickets por día y hora (hora local)',
    meta,
    [
      { header: 'Día', width: 12 },
      ...hourList.map((h) => ({ header: `${h}:00`, width: 7, format: INTEGER })),
    ],
    WEEKDAYS.map((day, d) => [
      day,
      ...hourList.map(
        (h) => data.payments.hours.find((x) => x.weekday === d + 1 && x.hour === h)?.tickets ?? 0,
      ),
    ]),
  );
  const lastCol = hoursSheet.getColumn(hourList.length + 1).letter;
  hoursSheet.addConditionalFormatting({
    ref: `B5:${lastCol}11`,
    rules: [
      {
        type: 'colorScale',
        priority: 1,
        cfvo: [{ type: 'min' }, { type: 'max' }],
        color: [{ argb: 'FFFFFFFF' }, { argb: 'FF6DA7EC' }],
      },
    ],
  });

  // ---- Compras ---------------------------------------------------------------------------------
  tableSheet(
    workbook,
    'Compras',
    'Compras por periodo',
    meta,
    [
      { header: 'Periodo', width: 16 },
      { header: 'Inicio', width: 12, format: 'dd/mm/yyyy' },
      { header: 'Total', width: 16, format: MONEY, total: 'sum' },
      { header: 'Entradas', width: 10, format: INTEGER, total: 'sum' },
    ],
    data.purchases.points.map((pt) => [
      periodLabel(pt.period, data.purchases.granularity),
      excelDate(pt.period),
      money(pt.totalCents),
      pt.count,
    ]),
  );
  tableSheet(
    workbook,
    'Compras por proveedor',
    'Compras por proveedor',
    meta,
    [
      { header: 'Proveedor', width: 30 },
      { header: 'Total', width: 16, format: MONEY, total: 'sum' },
      { header: 'Entradas', width: 10, format: INTEGER, total: 'sum' },
      { header: '% del total', width: 12, format: PERCENT },
    ],
    data.purchases.bySupplier.map((s) => [s.name, money(s.totalCents), s.count, ratio(s.shareBp)]),
  );
  tableSheet(
    workbook,
    'Productos comprados',
    'Productos comprados',
    meta,
    [
      { header: 'Código', width: 9 },
      { header: 'Producto', width: 34 },
      { header: 'Unidad', width: 8 },
      { header: 'Cantidad', width: 12, format: '#,##0.000' },
      { header: 'Total', width: 16, format: MONEY, total: 'sum' },
      { header: 'Costo promedio', width: 16, format: MONEY },
    ],
    data.purchases.byProduct.map((p) => [
      p.code,
      p.name,
      UNITS[p.unit].label,
      qty(p.qtyBase, p.unit),
      money(p.totalCents),
      money(p.avgUnitCostCents),
    ]),
  );

  // ---- Negocios (superadmin) ---------------------------------------------------------------------
  if (data.businesses) {
    tableSheet(
      workbook,
      'Negocios',
      'Comparativa de negocios',
      meta,
      [
        { header: 'Negocio', width: 28 },
        { header: 'Ventas', width: 16, format: MONEY, total: 'sum' },
        { header: 'Ganancia', width: 16, format: MONEY, total: 'sum' },
        { header: 'Margen', width: 10, format: PERCENT },
        { header: 'Tickets', width: 10, format: INTEGER, total: 'sum' },
        { header: 'Ticket promedio', width: 16, format: MONEY },
        { header: 'Compras', width: 16, format: MONEY, total: 'sum' },
        { header: '% de las ventas', width: 12, format: PERCENT },
      ],
      data.businesses.items.map((b) => [
        b.name,
        money(b.salesCents),
        money(b.profitCents),
        ratio(b.marginBp),
        b.tickets,
        money(b.avgTicketCents),
        money(b.purchasesCents),
        ratio(b.shareBp),
      ]),
    );
  }

  return workbook;
}

/** Fecha de calendario como fecha de Excel (sin hora ni zona: medianoche UTC). */
function excelDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}
