import { TestBed } from '@angular/core/testing';
import { Cart } from './cart';
import { suggestedCash } from './payment-dialog';
import { PosCatalog } from './pos-catalog';
import type { PosProduct } from './pos-models';

const products = new Map<string, PosProduct>([
  [
    'cam',
    {
      id: 'cam',
      code: '101',
      name: 'Camarón',
      categoryId: null,
      unit: 'kg',
      salePriceCents: 38900,
      taxRateBp: 0,
      stock: 10000,
      minStock: 0,
    },
  ],
  [
    'cer',
    {
      id: 'cer',
      code: '402',
      name: 'Cerveza',
      categoryId: null,
      unit: 'pz',
      salePriceCents: 3200,
      taxRateBp: 1600,
      stock: 24,
      minStock: 0,
    },
  ],
]);

function setup() {
  TestBed.configureTestingModule({
    providers: [Cart, { provide: PosCatalog, useValue: { get: (id: string) => products.get(id) } }],
  });
  return TestBed.inject(Cart);
}

describe('Cart', () => {
  it('totales con precio del catálogo e IVA solo donde aplica', () => {
    const cart = setup();
    cart.add(products.get('cam')!, 1250, true);
    cart.add(products.get('cer')!, 3);

    expect(cart.totalCents()).toBe(48625 + 9600);
    expect(cart.taxCents()).toBe(1324);
    expect(cart.toSaleItems()).toEqual([
      { productId: 'cam', qtyBase: 1250, weighed: true },
      { productId: 'cer', qtyBase: 3, weighed: false },
    ]);
  });

  it('piezas se acumulan en el mismo renglón; cada pesada es renglón nuevo', () => {
    const cart = setup();
    cart.add(products.get('cer')!, 1);
    cart.add(products.get('cer')!, 2);
    cart.add(products.get('cam')!, 500);
    cart.add(products.get('cam')!, 700);

    expect(cart.lines().map((l) => [l.productId, l.qtyBase])).toEqual([
      ['cer', 3],
      ['cam', 500],
      ['cam', 700],
    ]);
  });

  it('cantidad 0 quita el renglón; productos fuera del catálogo quedan marcados', () => {
    const cart = setup();
    cart.add(products.get('cer')!, 1);
    const key = cart.lines()[0]!.key;
    cart.setQty(key, 0);
    expect(cart.isEmpty()).toBe(true);

    cart.add({ ...products.get('cer')!, id: 'gone' }, 1);
    expect(cart.hasUnavailable()).toBe(true);
    expect(cart.totalCents()).toBe(0);
  });
});

describe('Cart: existencia', () => {
  it('marca los renglones cuando el total del producto pasa de su existencia', () => {
    const cart = setup();
    cart.add(products.get('cer')!, 24); // existencia 24: justo alcanza
    expect(cart.exceedsStock()).toBe(false);
    cart.add(products.get('cer')!, 1);
    expect(cart.lines()[0]!.exceedsStock).toBe(true);
    expect(cart.exceedsStock()).toBe(true);

    // Peso en varios renglones: 6 kg + 5 kg = 11 kg > 10 kg → los dos renglones avisan.
    cart.add(products.get('cam')!, 6000);
    cart.add(products.get('cam')!, 5000);
    const shrimp = cart.lines().filter((l) => l.productId === 'cam');
    expect(shrimp.map((l) => l.exceedsStock)).toEqual([true, true]);
    expect(cart.qtyInCart('cam')).toBe(11000);
    expect(cart.qtyInCart('cam', shrimp[0]!.key)).toBe(5000);
  });
});

describe('suggestedCash', () => {
  it('billetes por encima del total', () => {
    expect(suggestedCash(58225)).toEqual([60000, 100000]);
    expect(suggestedCash(3200)).toEqual([5000, 10000, 20000, 50000]);
  });
});
