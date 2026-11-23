import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form } from '@angular/forms/signals';
import { PosQtyInput } from '../qty-input/qty-input';
import { PosMoneyInput } from './money-input';

@Component({
  imports: [PosMoneyInput, PosQtyInput, FormField],
  template: `
    <pos-money-input label="Precio" [formField]="f.price" />
    <pos-qty-input label="Peso" [unit]="unit()" [formField]="f.qty" />
  `,
})
class Host {
  readonly unit = signal<'kg' | 'pz'>('kg');
  readonly model = signal({ price: 38900, qty: 0 });
  readonly f = form(this.model);
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const [money, qty] = Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll('input'),
  ) as HTMLInputElement[];
  const type = async (el: HTMLInputElement, text: string) => {
    el.dispatchEvent(new Event('focus'));
    el.value = text;
    el.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const blur = async (el: HTMLInputElement) => {
    el.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };
  return { fixture, money: money as HTMLInputElement, qty: qty as HTMLInputElement, type, blur };
}

describe('PosMoneyInput', () => {
  it('muestra el valor formateado y guarda centavos enteros', async () => {
    const { fixture, money, type, blur } = await setup();
    expect(money.value).toBe('389.00');

    await type(money, '1,234.5');
    expect(fixture.componentInstance.model().price).toBe(123450);

    await blur(money);
    expect(money.value).toBe('1,234.50');
  });

  it('texto inválido no cambia el valor y avisa; al salir vuelve al último válido', async () => {
    const { fixture, money, type, blur } = await setup();
    await type(money, '12.345');
    expect(fixture.componentInstance.model().price).toBe(38900);
    expect((fixture.nativeElement as HTMLElement).querySelector('.error')?.textContent).toContain(
      'monto válido',
    );
    await blur(money);
    expect(money.value).toBe('389.00');
  });
});

describe('PosQtyInput', () => {
  it('kg con decimales → gramos', async () => {
    const { fixture, qty, type, blur } = await setup();
    await type(qty, '1.25');
    expect(fixture.componentInstance.model().qty).toBe(1250);
    await blur(qty);
    expect(qty.value).toBe('1.250');
  });

  it('piezas solo enteras', async () => {
    const { fixture, qty, type } = await setup();
    fixture.componentInstance.unit.set('pz');
    await fixture.whenStable();
    await type(qty, '1.5');
    expect(fixture.componentInstance.model().qty).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelector('.error')?.textContent).toContain(
      'entera',
    );
  });
});
