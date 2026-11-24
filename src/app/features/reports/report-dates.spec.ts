import { describe, expect, it } from 'vitest';
import {
  periodLabel,
  presetRange,
  rangeLabel,
  sameDaysLastMonth,
  timeIn,
  timeLabel,
  todayIn,
} from './report-dates';

describe('fechas de reportes', () => {
  it('"hoy" se calcula en la zona del negocio, no en UTC', () => {
    // 05:30 UTC del 9 de marzo = 23:30 del 8 de marzo en CDMX.
    expect(todayIn('America/Mexico_City', new Date('2026-03-09T05:30:00Z'))).toBe('2026-03-08');
    expect(todayIn('UTC', new Date('2026-03-09T05:30:00Z'))).toBe('2026-03-09');
  });

  it('hora local del negocio (24 h) y su texto', () => {
    expect(timeIn('America/Mexico_City', new Date('2026-03-09T05:30:00Z'))).toBe('23:30');
    expect(timeIn('America/Mexico_City', new Date('2026-03-09T06:05:00Z'))).toBe('00:05');
    expect(timeLabel('18:05')).toBe('6:05 p. m.');
    expect(timeLabel('00:05')).toBe('12:05 a. m.');
    expect(timeLabel('12:00')).toBe('12:00 p. m.');
  });

  it('mismos días del mes anterior (recortado si el mes es más corto)', () => {
    expect(sameDaysLastMonth('2026-11-23')).toEqual({ from: '2026-10-01', to: '2026-10-23' });
    expect(sameDaysLastMonth('2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(sameDaysLastMonth('2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-15' });
    expect(sameDaysLastMonth('2026-11-01')).toEqual({ from: '2026-10-01', to: '2026-10-01' });
  });

  it('presets', () => {
    const today = '2026-03-08';
    expect(presetRange('today', today)).toEqual({ from: today, to: today });
    expect(presetRange('yesterday', today)).toEqual({ from: '2026-03-07', to: '2026-03-07' });
    expect(presetRange('last7', today)).toEqual({ from: '2026-03-02', to: today });
    expect(presetRange('last30', today)).toEqual({ from: '2026-02-07', to: today });
    expect(presetRange('thisMonth', today)).toEqual({ from: '2026-03-01', to: today });
    expect(presetRange('lastMonth', today)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(presetRange('thisYear', today)).toEqual({ from: '2026-01-01', to: today });
    expect(presetRange('last12m', today)).toEqual({ from: '2025-04-01', to: today });
    expect(presetRange('lastMonth', '2026-01-15')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('etiquetas de periodo y de rango', () => {
    expect(periodLabel('2026-03-02', 'day')).toBe('2 mar');
    expect(periodLabel('2026-03-02', 'week')).toBe('sem. 2 mar');
    expect(periodLabel('2026-03-01', 'month')).toBe('mar 2026');
    expect(periodLabel('2026-01-01', 'year')).toBe('2026');
    expect(rangeLabel('2026-03-08', '2026-03-08')).toBe('8 mar 2026');
    expect(rangeLabel('2026-03-01', '2026-03-08')).toBe('1 – 8 mar 2026');
    expect(rangeLabel('2026-02-07', '2026-03-08')).toBe('7 feb – 8 mar 2026');
    expect(rangeLabel('2025-04-01', '2026-03-08')).toBe('1 abr 2025 – 8 mar 2026');
  });
});
