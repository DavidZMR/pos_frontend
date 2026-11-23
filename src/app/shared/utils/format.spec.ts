import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatQty } from './format';

describe('formatMoney', () => {
  it('formatea centavos como pesos mexicanos', () => {
    expect(formatMoney(123450)).toBe('$1,234.50');
    expect(formatMoney(5)).toBe('$0.05');
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('muestra guion para valores vacíos', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
  });
});

describe('formatQty', () => {
  it('formatea según la unidad', () => {
    expect(formatQty(1250, 'kg')).toBe('1.250 kg');
    expect(formatQty(3, 'pz')).toBe('3 pz');
    expect(formatQty(500, 'l')).toBe('0.500 l');
  });
});

describe('formatDate', () => {
  it('maneja fechas inválidas o vacías', () => {
    expect(formatDate('no-es-fecha')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });
});
