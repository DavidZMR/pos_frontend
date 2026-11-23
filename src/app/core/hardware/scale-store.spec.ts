import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import type { PosBridge, ScaleReading, ScaleStatus } from '../config/pos-bridge';
import { ScaleStore } from './scale-store';

/** Puente de Electron falso (solo prueba) para emitir eventos de la báscula. */
function fakeBridge(snapshot: { status: ScaleStatus; reading: ScaleReading | null }) {
  const listeners = {
    status: [] as ((s: ScaleStatus) => void)[],
    reading: [] as ((r: ScaleReading | null) => void)[],
  };
  const bridge: PosBridge = {
    scale: {
      getState: () => Promise.resolve(snapshot),
      saveConfig: (c) => Promise.resolve(c),
      listPorts: () => Promise.resolve([]),
      detect: () => Promise.resolve({ scale: null, message: '' }),
      onStatus: (cb) => {
        listeners.status.push(cb);
        return () => listeners.status.splice(listeners.status.indexOf(cb), 1);
      },
      onReading: (cb) => {
        listeners.reading.push(cb);
        return () => listeners.reading.splice(listeners.reading.indexOf(cb), 1);
      },
      onDetectProgress: () => () => {},
    },
  };
  return { bridge, listeners };
}

function setup(pos?: PosBridge) {
  TestBed.configureTestingModule({
    providers: [{ provide: DOCUMENT, useValue: { defaultView: { pos } } }],
  });
  return TestBed.inject(ScaleStore);
}

describe('ScaleStore', () => {
  it('en el navegador no hay báscula: deshabilitada', () => {
    const store = setup(undefined);
    expect(store.supported).toBe(false);
    expect(store.enabled()).toBe(false);
    expect(store.reading()).toBeNull();
  });

  it('toma la foto inicial y luego sigue los eventos de Electron', async () => {
    const { bridge, listeners } = fakeBridge({
      status: { state: 'connected', message: 'Báscula conectada', path: 'COM3' },
      reading: { grams: 500, stable: true, at: 1 },
    });
    const store = setup(bridge);
    await Promise.resolve();
    expect(store.connected()).toBe(true);
    expect(store.reading()?.grams).toBe(500);

    for (const cb of listeners.reading) cb({ grams: 1250, stable: false, at: 2 });
    expect(store.reading()).toEqual({ grams: 1250, stable: false, at: 2 });

    // Al desconectarse se borra la lectura: nunca se vende con un peso viejo.
    for (const cb of listeners.status)
      cb({ state: 'error', message: 'Se desconectó', path: 'COM3' });
    expect(store.connected()).toBe(false);
    expect(store.reading()).toBeNull();
  });

  it('un evento que llega antes que la foto inicial no se pisa', async () => {
    const { bridge, listeners } = fakeBridge({
      status: { state: 'waiting', message: '', path: 'COM3' },
      reading: null,
    });
    const store = setup(bridge);
    for (const cb of listeners.status) cb({ state: 'connected', message: '', path: 'COM3' });
    await Promise.resolve();
    expect(store.status().state).toBe('connected');
  });
});
