import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';
import { Chart, type ChartConfiguration, type Plugin } from 'chart.js';
import { AuthStore } from '../../../core/auth/auth-store';
import { CatalogLookups } from '../../catalog/catalog-lookups';
import { PosCatalog } from '../../pos/pos-catalog';
import {
  type ChartSlot,
  rankedChartConfig,
  readChartColors,
  trendChartConfig,
} from '../../../shared/charts/chart-config';
import { formatMoneyCompact } from '../../../shared/charts/chart-format';
import { formatDateTime, formatMoney } from '../../../shared/utils/format';
import { PAYMENT_LABEL, PAYMENT_METHODS } from '../../pos/pos-models';
import { periodLabel, rangeLabel } from '../report-dates';
import type { ReportFilters } from '../report-filters';
import {
  type BusinessesReport,
  type CategoriesReport,
  GRANULARITY_LABEL,
  type PaymentsReport,
  type PurchasesReport,
  type SalesSeries,
  type SummaryReport,
  type TopProductsReport,
} from '../report-models';
import { ReportsApi } from '../reports-api';
import { buildReportWorkbook, type ChartImages, type ReportBundle } from './workbook-builder';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Exporta los reportes con los filtros actuales a un Excel tipo dashboard. */
@Service()
export class ReportExporter {
  private readonly api = inject(ReportsApi);
  private readonly auth = inject(AuthStore);
  private readonly document = inject(DOCUMENT);
  private readonly lookups = inject(CatalogLookups);
  private readonly catalog = inject(PosCatalog);

  async export(filters: ReportFilters, businessName: string): Promise<string> {
    const query = filters.query();
    const allBusinesses = filters.allBusinesses() && this.auth.isSuperadmin();
    const [summary, series, top, categories, payments, purchases, businesses] = await Promise.all([
      this.api.get<SummaryReport>('summary', query),
      this.api.get<SalesSeries>('sales-series', query),
      this.api.get<TopProductsReport>('top-products', { ...query, sort: 'amount', limit: 50 }),
      this.api.get<CategoriesReport>('categories', query),
      this.api.get<PaymentsReport>('payments', query),
      this.api.get<PurchasesReport>('purchases', purchaseParams(query)),
      allBusinesses
        ? this.api.get<BusinessesReport>('businesses', filters.range())
        : Promise.resolve(null),
    ]);
    const data: ReportBundle = {
      summary,
      series,
      top,
      categories,
      payments,
      purchases,
      businesses,
    };

    const { default: ExcelJS } = await import('exceljs');
    const { from, to } = filters.range();
    const workbook = buildReportWorkbook(
      ExcelJS,
      data,
      {
        businessName,
        rangeText: rangeLabel(from, to),
        previousText: rangeLabel(summary.previous.from, summary.previous.to),
        filtersText: this.filtersText(filters),
        generatedAt: formatDateTime(new Date()),
      },
      this.renderImages(data),
    );
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Reporte ${businessName} ${from} a ${to}.xlsx`.replace(/[\\/:*?"<>|]/g, '-');
    this.download(new Blob([buffer], { type: XLSX_TYPE }), fileName);
    return fileName;
  }

  /** Gráficas dibujadas fuera de pantalla (mismo estilo que en la app) a PNG. */
  private renderImages(data: ReportBundle): ChartImages {
    const colors = readChartColors(this.document);
    const render = <T extends 'line' | 'bar'>(
      config: ChartConfiguration<T>,
      width: number,
      height: number,
    ): string => {
      const canvas = this.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      // Fondo blanco: Excel muestra el PNG transparente sobre la cuadrícula.
      const background: Plugin<T> = {
        id: 'posWhite',
        beforeDraw: (chart) => {
          const { ctx } = chart;
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, chart.width, chart.height);
          ctx.restore();
        },
      };
      const chart = new Chart<T>(canvas, {
        ...config,
        options: { ...config.options, responsive: false, animation: false, devicePixelRatio: 2 },
        plugins: [...(config.plugins ?? []), background],
      } as ChartConfiguration<T>);
      const image = chart.toBase64Image('image/png');
      chart.destroy();
      return image;
    };

    const g = data.series.granularity;
    const images: ChartImages = {
      trend: render(
        trendChartConfig({
          kind: 'line',
          labels: data.series.points.map((p) => periodLabel(p.period, g)),
          series: [
            { label: 'Ventas', values: data.series.points.map((p) => p.salesCents), slot: 1 },
            { label: 'Ganancia', values: data.series.points.map((p) => p.profitCents), slot: 2 },
          ],
          format: formatMoney,
          formatAxis: formatMoneyCompact,
          colors,
          animate: false,
        }),
        720,
        300,
      ),
    };
    const top10 = data.top.items.slice(0, 10);
    if (top10.length) {
      images.top = render(
        rankedChartConfig({
          labels: top10.map((p) => p.name),
          values: top10.map((p) => p.salesCents),
          format: formatMoney,
          formatAxis: formatMoneyCompact,
          colors,
        }),
        720,
        340,
      );
    }
    if (data.categories.items.length) {
      images.categories = render(
        rankedChartConfig({
          labels: data.categories.items.map((c) => c.name),
          values: data.categories.items.map((c) => c.salesCents),
          format: formatMoney,
          formatAxis: formatMoneyCompact,
          colors,
        }),
        380,
        240,
      );
    }
    images.methods = render(
      rankedChartConfig({
        labels: data.payments.byMethod.map((m) => PAYMENT_LABEL[m.method].label),
        values: data.payments.byMethod.map((m) => m.amountCents),
        slots: data.payments.byMethod.map(
          (m) => (PAYMENT_METHODS.indexOf(m.method) + 1) as ChartSlot,
        ),
        format: formatMoney,
        formatAxis: formatMoneyCompact,
        colors,
      }),
      380,
      200,
    );
    return images;
  }

  /** Filtros aplicados con nombres legibles (para el encabezado del Excel). */
  private filtersText(filters: ReportFilters): string {
    const parts: string[] = [];
    const granularity = filters.granularity();
    if (granularity) parts.push(`agrupado por ${GRANULARITY_LABEL[granularity].toLowerCase()}`);
    const category = filters.categoryId();
    if (category) {
      const name = this.lookups.categoryOptions().find((c) => c.value === category)?.label;
      parts.push(`categoría: ${name ?? category}`);
    }
    const product = filters.productId();
    if (product)
      parts.push(
        `producto: ${this.catalog.products().find((p) => p.id === product)?.name ?? product}`,
      );
    if (filters.cashierId()) parts.push('un cajero');
    const method = filters.method();
    if (method) parts.push(`pago: ${PAYMENT_LABEL[method].label}`);
    return parts.join(', ');
  }

  /** Descarga normal (navegador); en Electron se abre el diálogo "Guardar como". */
  private download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    this.document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

function purchaseParams(query: Record<string, unknown>): Record<string, unknown> {
  const { from, to, granularity, productId, scope } = query;
  return Object.fromEntries(
    Object.entries({ from, to, granularity, productId, scope }).filter(([, v]) => v),
  );
}
