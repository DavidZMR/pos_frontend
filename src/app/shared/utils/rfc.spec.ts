import { describe, expect, it } from 'vitest';
import { isValidRfc } from './rfc';

describe('isValidRfc', () => {
  it('acepta moral (12), física (13), genérico y vacío', () => {
    for (const rfc of [
      'ABC010101XYZ',
      'abc010101xy1',
      'GODE561231GR8',
      'XAXX010101000',
      '',
      '  ',
    ]) {
      expect(isValidRfc(rfc), rfc).toBe(true);
    }
  });
  it('rechaza lo demás', () => {
    for (const rfc of ['xx', 'ABC123', '1BC010101XYZ', 'ABC0101011XYZ9', 'ABC-010101-XYZ']) {
      expect(isValidRfc(rfc), rfc).toBe(false);
    }
  });
});
