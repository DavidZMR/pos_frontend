import type { ChartConfiguration, Plugin } from 'chart.js';

/**
 * Configuración de gráficas con Chart.js según la guía de visualización (skill dataviz):
 * marcas delgadas (líneas de 2 px, columnas ≤ 24 px con punta redondeada y base recta),
 * cuadrícula de línea fina sin guiones, un solo eje, cursor que se ajusta al periodo y tooltip
 * con el valor primero. Pura: la usan el componente y la exportación a Excel (imágenes).
 */

export type ChartSlot = 1 | 2 | 3 | 4;

export interface TrendSeries {
  label: string;
  values: number[];
  slot: ChartSlot;
}

export interface TrendChartInput {
  kind: 'line' | 'column';
  labels: string[];
  series: TrendSeries[];
  /** Texto de un valor (tooltip). */
  format: (value: number) => string;
  /** Texto compacto para el eje Y ("$12 mil"). */
  formatAxis: (value: number) => string;
  /** Colores ya resueltos (CSS) por ranura y de la estructura. */
  colors: ChartColors;
  animate?: boolean;
}

export interface ChartColors {
  slots: Record<ChartSlot, string>;
  grid: string;
  axis: string;
  ink: string;
  inkMuted: string;
  surface: string;
  tooltipBg: string;
  tooltipInk: string;
  font: string;
}

/** Lee los tokens de color del documento (las gráficas de canvas necesitan valores reales). */
export function readChartColors(doc: Document): ChartColors {
  const style = getComputedStyle(doc.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    slots: {
      1: token('--chart-1'),
      2: token('--chart-2'),
      3: token('--chart-3'),
      4: token('--chart-4'),
    },
    grid: token('--chart-grid'),
    axis: token('--chart-axis'),
    ink: token('--ink'),
    inkMuted: token('--ink-muted'),
    surface: token('--surface-raised'),
    tooltipBg: token('--surface-inverse'),
    tooltipInk: token('--ink-inverse'),
    font: getComputedStyle(doc.body).fontFamily,
  };
}

/** Línea vertical fina en el periodo activo: el lector apunta a una fecha, no a una línea de 2 px. */
export const crosshairPlugin: Plugin<'line' | 'bar'> = {
  id: 'posCrosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements?.() ?? [];
    if (!active.length || (chart.config as { type?: string }).type !== 'line') return;
    const x = active[0]?.element.x;
    if (x === undefined) return;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = (chart.options.scales?.['x']?.grid?.color as string) ?? '#ccc';
    ctx.stroke();
    ctx.restore();
  },
};

/** Convierte un color CSS a rgba con opacidad (para el área de una sola serie: ~10 %). */
function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return color;
  const n = Number.parseInt(hex[1] as string, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function trendChartConfig(input: TrendChartInput): ChartConfiguration<'line' | 'bar'> {
  const { colors } = input;
  const single = input.series.length === 1;
  const isLine = input.kind === 'line';

  const datasets = input.series.map((s) => {
    const color = colors.slots[s.slot];
    if (isLine) {
      return {
        type: 'line' as const,
        label: s.label,
        data: s.values,
        borderColor: color,
        backgroundColor: single ? withAlpha(color, 0.1) : color,
        fill: single ? 'origin' : false,
        borderWidth: 2,
        borderCapStyle: 'round' as const,
        borderJoinStyle: 'round' as const,
        tension: 0,
        pointRadius: input.labels.length <= 14 ? 3 : 0,
        pointBackgroundColor: color,
        pointBorderColor: colors.surface,
        pointBorderWidth: 2,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: colors.surface,
        pointHitRadius: 12,
      };
    }
    return {
      type: 'bar' as const,
      label: s.label,
      data: s.values,
      backgroundColor: color,
      hoverBackgroundColor: color,
      borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
      borderSkipped: 'start' as const,
      maxBarThickness: 24,
      categoryPercentage: 0.8,
      barPercentage: 0.9,
    };
  });

  return {
    type: isLine ? 'line' : 'bar',
    data: { labels: input.labels, datasets },
    plugins: [crosshairPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: input.animate === false ? false : { duration: 350 },
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 8, right: 8 } },
      font: { family: colors.font },
      plugins: {
        legend: { display: false }, // la leyenda va en HTML (accesible, con texto real)
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipInk,
          bodyColor: colors.tooltipInk,
          titleFont: { family: colors.font, weight: 'normal', size: 12 },
          bodyFont: { family: colors.font, weight: 'bold', size: 13 },
          padding: 10,
          cornerRadius: 6,
          displayColors: true,
          usePointStyle: true,
          boxPadding: 4,
          callbacks: {
            // El valor manda; el nombre de la serie va después.
            label: (item) =>
              `${input.format(Number(item.raw))}  ${single ? '' : item.dataset.label}`,
            labelPointStyle: () => ({ pointStyle: 'line', rotation: 0 }),
          },
        },
      },
      scales: {
        x: {
          grid: { display: false, color: colors.grid },
          border: { color: colors.axis },
          ticks: {
            color: colors.inkMuted,
            font: { family: colors.font, size: 11 },
            maxRotation: 0,
            autoSkip: true,
            autoSkipPadding: 12,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: colors.grid, lineWidth: 1 },
          border: { display: false },
          ticks: {
            color: colors.inkMuted,
            font: { family: colors.font, size: 11 },
            maxTicksLimit: 6,
            callback: (value) => input.formatAxis(Number(value)),
          },
        },
      },
    },
  };
}

export interface RankedChartInput {
  labels: string[];
  values: number[];
  format: (value: number) => string;
  formatAxis: (value: number) => string;
  colors: ChartColors;
  /** Una ranura por barra (formas de pago); si falta, todas usan la 1. */
  slots?: ChartSlot[];
}

/** Barras horizontales ordenadas (para imágenes del Excel; en pantalla se usa HTML). */
export function rankedChartConfig(input: RankedChartInput): ChartConfiguration<'bar'> {
  const { colors } = input;
  return {
    type: 'bar',
    data: {
      labels: input.labels,
      datasets: [
        {
          data: input.values,
          backgroundColor: input.values.map((_, i) => colors.slots[input.slots?.[i] ?? 1]),
          borderRadius: { topRight: 4, bottomRight: 4, topLeft: 0, bottomLeft: 0 },
          borderSkipped: 'start',
          maxBarThickness: 22,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: false,
      animation: false,
      layout: { padding: { right: 16 } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: colors.grid },
          border: { display: false },
          ticks: {
            color: colors.inkMuted,
            font: { family: colors.font, size: 11 },
            maxTicksLimit: 6,
            callback: (value) => input.formatAxis(Number(value)),
          },
        },
        y: {
          grid: { display: false },
          border: { color: colors.axis },
          ticks: { color: colors.ink, font: { family: colors.font, size: 12 } },
        },
      },
    },
  };
}
