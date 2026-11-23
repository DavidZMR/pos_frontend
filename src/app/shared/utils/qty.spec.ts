import { describe, expect, it } from 'vitest';
import { parseQtyToBase, qtyBaseToDecimalString, unitScale } from './qty.js';

describe('parseQtyToBase', () => {
  it('kg con hasta 3 decimales → gramos', () => {
    expect(parseQtyToBase('1.25', 'kg')).toBe(1250);
    expect(parseQtyToBase('0.335', 'kg')).toBe(335);
    expect(parseQtyToBase('2', 'kg')).toBe(2000);
  });

  it('litros → mililitros', () => {
    expect(parseQtyToBase('0.5', 'l')).toBe(500);
  });

  it('piezas solo enteras', () => {
    expect(parseQtyToBase('3', 'pz')).toBe(3);
    expect(() => parseQtyToBase('1.5', 'pz')).toThrow(RangeError);
  });

  it('rechaza más de 3 decimales en kg', () => {
    expect(() => parseQtyToBase('1.2345', 'kg')).toThrow(RangeError);
  });
});

describe('qtyBaseToDecimalString', () => {
  it('formatea según la unidad', () => {
    expect(qtyBaseToDecimalString(1250, 'kg')).toBe('1.250');
    expect(qtyBaseToDecimalString(5, 'kg')).toBe('0.005');
    expect(qtyBaseToDecimalString(3, 'pz')).toBe('3');
  });
});

describe('unitScale', () => {
  it('devuelve la escala de cada unidad', () => {
    expect([unitScale('pz'), unitScale('kg'), unitScale('l')]).toEqual([1, 1000, 1000]);
  });
});
