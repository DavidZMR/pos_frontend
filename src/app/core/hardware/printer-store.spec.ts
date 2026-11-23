import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import type { PosBridge, PrinterConfig, PrinterInfo } from '../config/pos-bridge';
import { PrinterStore } from './printer-store';

const PDF: PrinterInfo = {
  name: 'Microsoft Print to PDF',
  displayName: 'Microsoft Print to PDF',
  isDefault: true,
};
const THERMAL: PrinterInfo = { name: 'POS-80C', displayName: 'POS-80C', isDefault: false };

function fakeBridge(printer: Partial<PrinterConfig>, printers: PrinterInfo[]) {
  const config: PrinterConfig = { name: '', widthMm: 80, autoPrint: false, copies: 1, ...printer };
  const printed: string[] = [];
  const bridge: PosBridge = {
    hardware: {
      getConfig: () =>
        Promise.resolve({
          printer: config,
          scale: {} as never,
        }),
    },
    printer: {
      list: () => Promise.resolve(printers),
      saveConfig: (c) => Promise.resolve(c),
      print: ({ html }) => {
        printed.push(html);
        return Promise.resolve({ ok: true });
      },
    },
  };
  return { bridge, printed };
}

async function setup(pos?: PosBridge) {
  TestBed.configureTestingModule({
    providers: [{ provide: DOCUMENT, useValue: { defaultView: { pos } } }],
  });
  const store = TestBed.inject(PrinterStore);
  await store.refresh();
  return store;
}

describe('PrinterStore', () => {
  it('en el navegador no hay impresión', async () => {
    const store = await setup(undefined);
    expect(store.supported).toBe(false);
    expect(store.ready()).toBe(false);
    expect((await store.print('<p>x</p>')).ok).toBe(false);
  });

  it('sin impresora configurada: no está lista ni "no encontrada"', async () => {
    const store = await setup(fakeBridge({}, [PDF]).bridge);
    expect(store.ready()).toBe(false);
    expect(store.missing()).toBe(false);
  });

  it('lista si la impresora configurada está instalada en Windows', async () => {
    const { bridge, printed } = fakeBridge({ name: 'POS-80C' }, [PDF, THERMAL]);
    const store = await setup(bridge);
    expect(store.ready()).toBe(true);
    expect((await store.print('<p>ticket</p>')).ok).toBe(true);
    expect(printed).toEqual(['<p>ticket</p>']);
  });

  it('"no encontrada" si se configuró pero ya no aparece (desconectada o desinstalada)', async () => {
    const store = await setup(fakeBridge({ name: 'POS-80C' }, [PDF]).bridge);
    expect(store.ready()).toBe(false);
    expect(store.missing()).toBe(true);
  });

  it('sugiere las impresoras que parecen de tickets', async () => {
    const store = await setup(fakeBridge({}, []).bridge);
    expect(store.looksLikeTicketPrinter(THERMAL)).toBe(true);
    expect(
      store.looksLikeTicketPrinter({
        ...THERMAL,
        name: 'EPSON TM-T20II',
        displayName: 'EPSON TM-T20II',
      }),
    ).toBe(true);
    expect(store.looksLikeTicketPrinter(PDF)).toBe(false);
  });
});
