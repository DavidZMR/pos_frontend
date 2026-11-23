import { describe, expect, it } from 'vitest';
import { indexProducts, parseMultiplier, searchCatalog } from './catalog-search';
import type { PosProduct } from './pos-models';

const p = (code: string, name: string, barcode?: string): PosProduct => ({
  id: code,
  code,
  name,
  barcode,
  categoryId: null,
  unit: 'pz',
  salePriceCents: 100,
  taxRateBp: 0,
  stock: 1,
  minStock: 0,
});

const index = indexProducts([
  p('101', 'Camarón grande U-15'),
  p('102', 'Camarón mediano 41-50'),
  p('301', 'Coctel de camarón grande'),
  p('1010', 'Ostión en concha'),
  p('402', 'Cerveza clara 355 ml', '7501000000024'),
]);
const codes = (term: string) => searchCatalog(index, term).map((x) => x.code);

describe('searchCatalog', () => {
  it('código exacto primero, luego códigos que empiezan igual', () => {
    expect(codes('101')).toEqual(['101', '1010']);
  });

  it('código de barras exacto', () => {
    expect(codes('7501000000024')).toEqual(['402']);
  });

  it('nombre sin acentos: los que empiezan antes que los que contienen', () => {
    expect(codes('camaron')).toEqual(['101', '102', '301']);
  });

  it('varias palabras en cualquier orden', () => {
    expect(codes('grande cam')).toEqual(['101', '301']);
    expect(codes('concha ost')).toEqual(['1010']);
  });

  it('sin coincidencias o vacío → []', () => {
    expect(codes('pizza')).toEqual([]);
    expect(codes('   ')).toEqual([]);
  });
});

describe('parseMultiplier', () => {
  it('reconoce cantidad * término', () => {
    expect(parseMultiplier('3*402')).toEqual({ qty: '3', term: '402' });
    expect(parseMultiplier('1,5 x camaron')).toEqual({ qty: '1.5', term: 'camaron' });
  });

  it('sin multiplicador deja el término igual', () => {
    expect(parseMultiplier('camaron')).toEqual({ qty: null, term: 'camaron' });
    expect(parseMultiplier('41-50')).toEqual({ qty: null, term: '41-50' });
  });
});
