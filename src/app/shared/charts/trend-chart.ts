import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  type ElementRef,
  afterRenderEffect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { formatMoney } from '../utils/format';
import { type TrendSeries, readChartColors, trendChartConfig } from './chart-config';
import { formatMoneyCompact } from './chart-format';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

/**
 * Tendencia en el tiempo (línea) o magnitud por periodo (columnas). Un solo eje: dos medidas
 * de distinta escala van en dos gráficas. La leyenda (si hay ≥ 2 series) es HTML, arriba.
 *   <pos-trend-chart kind="line" [labels]="labels()" [series]="series()" ariaLabel="…" />
 */
@Component({
  selector: 'pos-trend-chart',
  template: `
    @if (series().length > 1) {
      <ul class="legend" aria-hidden="true">
        @for (s of series(); track s.label) {
          <li>
            <span
              class="key"
              [class.line]="kind() === 'line'"
              [style.background]="'var(--chart-' + s.slot + ')'"
            ></span>
            {{ s.label }}
          </li>
        }
      </ul>
    }
    <div class="frame" [class.loading]="loading()" [style.height.px]="height()">
      <canvas #canvas role="img" [attr.aria-label]="ariaLabel()"></canvas>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-4);
      margin: 0 0 var(--space-3);
      padding: 0;
      list-style: none;
      font-size: var(--text-xs);
      color: var(--ink-muted);
    }
    .legend li {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }
    .key {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 2px;
    }
    .key.line {
      height: 2px;
      width: 1rem;
    }
    .frame {
      position: relative;
      transition: opacity var(--dur) var(--ease-out);
    }
    .frame.loading {
      opacity: 0.45;
    }
  `,
})
export class PosTrendChart {
  readonly kind = input<'line' | 'column'>('line');
  readonly labels = input.required<string[]>();
  readonly series = input.required<TrendSeries[]>();
  readonly format = input<(value: number) => string>(formatMoney);
  readonly formatAxis = input<(value: number) => string>(formatMoneyCompact);
  readonly height = input(260);
  readonly ariaLabel = input('');
  /** Al recargar se conserva el dibujo anterior atenuado (sin saltos). */
  readonly loading = input(false);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly document = inject(DOCUMENT);
  private chart: Chart<'line' | 'bar'> | undefined;

  constructor() {
    afterRenderEffect(() => {
      const config = trendChartConfig({
        kind: this.kind(),
        labels: this.labels(),
        series: this.series(),
        format: this.format(),
        formatAxis: this.formatAxis(),
        colors: readChartColors(this.document),
      });
      this.chart?.destroy();
      this.chart = new Chart(this.canvas().nativeElement, config);
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }
}
