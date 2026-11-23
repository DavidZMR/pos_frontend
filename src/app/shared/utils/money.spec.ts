import { describe, expect, it } from 'vitest';
import {
  centsToDecimalString,
  includedTaxCents,
  lineTotalCents,
  parseMoneyToCents,
  weightedAverageCostCents,
} from './money.js';

describe('parseMoneyToCents', () => {
  it.each([
    ['0', 0],
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['.5', 50],
    ['$1,234.56', 123456],
    ['  99.99 ', 9999],
    ['-3.10', -310],
  ])('"%s" → %i', (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });

  it('no sufre errores de punto flotante (0.1 + 0.2, 19.99 × 100)', () => {
    expect(parseMoneyToCents('0.30')).toBe(30);
    expect(parseMoneyToCents('19.99')).toBe(1999);
    expect(parseMoneyToCents('1.15')).toBe(115);
  });

  it.each(['', 'abc', '1.234', '1..2', '12a'])('rechaza "%s"', (input) => {
    expect(() => parseMoneyToCents(input)).toThrow(RangeError);
  });
});

describe('centsToDecimalString', () => {
  it.each([
    [0, '0.00'],
    [5, '0.05'],
    [1250, '12.50'],
    [123456, '1234.56'],
    [-310, '-3.10'],
  ])('%i → "%s"', (cents, text) => {
    expect(centsToDecimalString(cents)).toBe(text);
  });
});

describe('lineTotalCents', () => {
  it('pieza: precio × cantidad', () => {
    expect(lineTotalCents(2550, 3, 1)).toBe(7650);
  });

  it('kilo: $289.00/kg × 1.250 kg = $361.25', () => {
    expect(lineTotalCents(28900, 1250, 1000)).toBe(36125);
  });

  it('redondea medio centavo hacia arriba: $189.90/kg × 0.335 kg = $63.6165 → $63.62', () => {
    expect(lineTotalCents(18990, 335, 1000)).toBe(6362);
  });
});

describe('includedTaxCents', () => {
  it('IVA 16 % contenido en $116.00 es $16.00', () => {
    expect(includedTaxCents(11600, 1600)).toBe(1600);
  });

  it('tasa 0 (exento) no tiene IVA', () => {
    expect(includedTaxCents(50000, 0)).toBe(0);
  });

  it('redondea al centavo', () => {
    expect(includedTaxCents(10000, 1600)).toBe(1379);
  });
});

describe('weightedAverageCostCents', () => {
  it('promedia el costo existente con la entrada', () => {
    // 10 kg a $100 + 10 kg a $120 → $110
    expect(weightedAverageCostCents(10_000, 10_000, 10_000, 12_000)).toBe(11_000);
  });

  it('sin stock (o negativo) toma el costo nuevo', () => {
    expect(weightedAverageCostCents(0, 10_000, 5_000, 13_000)).toBe(13_000);
    expect(weightedAverageCostCents(-500, 10_000, 5_000, 13_000)).toBe(13_000);
  });
});
