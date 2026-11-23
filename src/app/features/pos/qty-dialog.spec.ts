import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ScaleReading, ScaleStatus } from '../../core/config/pos-bridge';
import { ScaleStore } from '../../core/hardware/scale-store';
import type { PosProduct } from './pos-models';
import { QtyDialog, type QtyDialogData } from './qty-dialog';

const shrimp: PosProduct = {
  id: 'cam',
  code: '101',
  name: 'Camarón grande',
  categoryId: null,
  unit: 'kg',
  salePriceCents: 38900,
  taxRateBp: 0,
  stock: 10000,
  minStock: 0,
};

/** Báscula falsa (solo prueba): mismas signals que ScaleStore. */
function fakeScale(state: ScaleStatus['state'] = 'connected', supported = true) {
  const status = signal<ScaleStatus>({ state, message: 'La báscula no envía datos', path: 'COM3' });
  const reading = signal<ScaleReading | null>(null);
  return {
    supported,
    status,
    reading,
    enabled: computed(() => status().state !== 'disabled'),
    connected: computed(() => status().state === 'connected'),
  };
}

async function setup(scale = fakeScale(), data: QtyDialogData = { product: shrimp }) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: ScaleStore, useValue: scale },
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(QtyDialog);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector('input') as HTMLInputElement;
  const submit = el.querySelector('button[type="submit"]') as HTMLButtonElement;
  const note = () => el.querySelector('.scale')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const confirm = async () => {
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  const typeWeight = async (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
  };
  return { fixture, scale, close, input, submit, note, confirm, typeWeight };
}

describe('QtyDialog con báscula', () => {
  it('el peso se llena solo y no deja agregar hasta que se estabiliza', async () => {
    const t = await setup();
    expect(t.note()).toContain('Coloca el producto');
    expect(t.submit.disabled).toBe(true);

    t.scale.reading.set({ grams: 1240, stable: false, at: 1 });
    await t.fixture.whenStable();
    expect(t.input.value).toBe('1.240');
    expect(t.note()).toContain('Pesando');
    expect(t.submit.disabled).toBe(true);
    await t.confirm();
    expect(t.close).not.toHaveBeenCalled();

    t.scale.reading.set({ grams: 1250, stable: true, at: 2 });
    await t.fixture.whenStable();
    expect(t.input.value).toBe('1.250');
    expect(t.note()).toContain('Peso estable');
    expect(t.fixture.nativeElement.querySelector('.total').textContent).toContain('$486.25');
    await t.confirm();
    expect(t.close).toHaveBeenCalledWith({ qtyBase: 1250, weighed: true });
  });

  it('si el cajero escribe, manda lo escrito (weighed: false) y puede volver a la báscula', async () => {
    const t = await setup();
    t.scale.reading.set({ grams: 900, stable: true, at: 1 });
    await t.fixture.whenStable();
    await t.typeWeight('1');
    expect(t.note()).toContain('Peso escrito a mano');

    t.scale.reading.set({ grams: 950, stable: true, at: 2 });
    await t.fixture.whenStable();
    expect(t.input.value).toBe('1'); // ya no sigue a la báscula

    await t.confirm();
    expect(t.close).toHaveBeenCalledWith({ qtyBase: 1000, weighed: false });
  });

  it('"Usar báscula" vuelve a tomar el peso leído', async () => {
    const t = await setup();
    await t.typeWeight('2');
    (t.fixture.nativeElement.querySelector('.scale button') as HTMLButtonElement).click();
    t.scale.reading.set({ grams: 730, stable: true, at: 3 });
    await t.fixture.whenStable();
    expect(t.input.value).toBe('0.730');
    await t.confirm();
    expect(t.close).toHaveBeenCalledWith({ qtyBase: 730, weighed: true });
  });

  it('báscula configurada pero sin datos: avisa y se escribe el peso', async () => {
    const t = await setup(fakeScale('waiting'));
    expect(t.note()).toContain('La báscula no envía datos');
    expect(t.submit.disabled).toBe(false);
    await t.typeWeight('0.5');
    await t.confirm();
    expect(t.close).toHaveBeenCalledWith({ qtyBase: 500, weighed: false });
  });

  it('una tara negativa cuenta como cero', async () => {
    const t = await setup();
    t.scale.reading.set({ grams: -20, stable: true, at: 1 });
    await t.fixture.whenStable();
    expect(t.note()).toContain('Coloca el producto');
    expect(t.submit.disabled).toBe(true);
  });
});

describe('QtyDialog sin báscula', () => {
  it('PC sin báscula: se escribe el peso, sin avisos de "no conectada"', async () => {
    const t = await setup(fakeScale('disabled'));
    expect(t.note()).toContain('Escribe el peso en kg');
    expect(t.note()).not.toContain('conectada');
    await t.typeWeight('1.5');
    await t.confirm();
    expect(t.close).toHaveBeenCalledWith({ qtyBase: 1500, weighed: false });
  });

  it('en el navegador (sin app de escritorio) también se escribe', async () => {
    const t = await setup(fakeScale('disabled', false));
    expect(t.note()).toContain('Escribe el peso');
  });

  it('productos por pieza no usan la báscula', async () => {
    const t = await setup(fakeScale(), { product: { ...shrimp, unit: 'pz' } });
    expect(t.note()).toBe('');
    await t.typeWeight('3');
    await t.confirm();
    expect(t.close).toHaveBeenCalledWith({ qtyBase: 3, weighed: false });
  });

  it('al editar un renglón por peso empieza con el valor actual, a mano', async () => {
    const t = await setup(fakeScale(), { product: shrimp, qtyBase: 2000 });
    t.scale.reading.set({ grams: 500, stable: true, at: 1 });
    await t.fixture.whenStable();
    expect(t.note()).toContain('Peso escrito a mano');
    await t.confirm();
    expect(t.close).toHaveBeenCalledWith({ qtyBase: 2000, weighed: false });
  });
});
