import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type ChartColors, trendChartConfig } from './chart-config';
import { deltaBp, formatBp, formatMoneyCompact } from './chart-format';
import { PosKpi } from './kpi';
import { PosRankedBars, type RankedBar } from './ranked-bars';

const colors: ChartColors = {
  slots: { 1: '#1b74a3', 2: '#eb6834', 3: '#1baf7a', 4: '#eda100' },
  grid: '#e0e0e0',
  axis: '#c0c0c0',
  ink: '#111',
  inkMuted: '#555',
  surface: '#fff',
  tooltipBg: '#000',
  tooltipInk: '#fff',
  font: 'sans-serif',
};

describe('formatos de gráficas', () => {
  it('cambio relativo y porcentajes', () => {
    expect(deltaBp(12_000, 10_000)).toBe(2000);
    expect(deltaBp(8_000, 10_000)).toBe(-2000);
    expect(deltaBp(5, 0)).toBeNull();
    expect(formatBp(3520)).toMatch(/^35\.2\s?%$/);
  });

  it('moneda compacta en ejes', () => {
    expect(formatMoneyCompact(250_000)).toBe('$2,500');
    expect(formatMoneyCompact(1_250_000)).toMatch(/^\$12\.5\s?(k|mil)$/);
  });
});

describe('trendChartConfig (guía dataviz)', () => {
  const base = { labels: ['1', '2'], format: String, formatAxis: String, colors };

  it('líneas de 2 px; una sola serie lleva área tenue; dos series sin área', () => {
    const single = trendChartConfig({
      ...base,
      kind: 'line',
      series: [{ label: 'Ventas', values: [1, 2], slot: 1 }],
    });
    const ds = single.data.datasets[0] as unknown as Record<string, unknown>;
    expect(ds['borderWidth']).toBe(2);
    expect(ds['fill']).toBe('origin');
    expect(ds['backgroundColor']).toBe('rgba(27, 116, 163, 0.1)');

    const two = trendChartConfig({
      ...base,
      kind: 'line',
      series: [
        { label: 'Ventas', values: [1, 2], slot: 1 },
        { label: 'Ganancia', values: [1, 1], slot: 2 },
      ],
    });
    expect(two.data.datasets.map((d) => (d as unknown as Record<string, unknown>)['fill'])).toEqual(
      [false, false],
    );
    expect(
      two.data.datasets.map((d) => (d as unknown as Record<string, unknown>)['borderColor']),
    ).toEqual(['#1b74a3', '#eb6834']);
  });

  it('columnas: máximo 24 px, punta redondeada y base recta; un solo eje Y desde cero', () => {
    const config = trendChartConfig({
      ...base,
      kind: 'column',
      series: [{ label: 'Tickets', values: [3, 4], slot: 1 }],
    });
    const ds = config.data.datasets[0] as unknown as Record<string, unknown>;
    expect(ds['maxBarThickness']).toBe(24);
    expect(ds['borderRadius']).toEqual({ topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 });
    expect(ds['borderSkipped']).toBe('start');
    const scales = config.options?.scales as Record<string, { beginAtZero?: boolean }>;
    expect(Object.keys(scales)).toEqual(['x', 'y']);
    expect(scales['y']?.beginAtZero).toBe(true);
  });
});

@Component({
  imports: [PosKpi, PosRankedBars],
  template: `
    <pos-kpi label="Ventas" value="$100" [deltaBp]="delta()" [upIsGood]="upIsGood()" />
    <pos-ranked-bars [items]="items" />
  `,
})
class Host {
  readonly delta = signal<number | null>(1500);
  readonly upIsGood = signal(true);
  readonly items: RankedBar[] = [
    { id: 'a', label: 'Camarón', value: 200, valueText: '$2.00' },
    { id: 'b', label: 'Cerveza', value: 50, valueText: '$0.50' },
  ];
}

describe('componentes de gráficas', () => {
  it('KPI: flecha + signo y color según si subir es bueno', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const delta = () => fixture.nativeElement.querySelector('.delta') as HTMLElement;
    expect(delta().className).toContain('good');
    expect(delta().textContent?.replace(/\s+/g, ' ')).toContain('+15.0');
    fixture.componentInstance.upIsGood.set(false);
    await fixture.whenStable();
    expect(delta().className).toContain('bad');
    fixture.componentInstance.delta.set(null);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.delta')).toBeNull();
  });

  it('barras ordenadas: la mayor al 100 % y el valor escrito en la punta', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const bars = fixture.nativeElement.querySelectorAll(
      'pos-ranked-bars .bar',
    ) as NodeListOf<HTMLElement>;
    expect(bars[0]?.style.width).toBe('100%');
    expect(bars[1]?.style.width).toBe('25%');
    expect(fixture.nativeElement.querySelector('pos-ranked-bars .value')?.textContent).toBe(
      '$2.00',
    );
  });
});
