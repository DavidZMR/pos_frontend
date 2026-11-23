import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast-service';

describe('ToastService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('muestra avisos y los retira solos', () => {
    const service = TestBed.inject(ToastService);
    service.success('Guardado');
    service.error('Falló');

    expect(service.toasts().map((t) => t.tone)).toEqual(['success', 'error']);

    vi.advanceTimersByTime(4000);
    expect(service.toasts().map((t) => t.message)).toEqual(['Falló']);

    vi.advanceTimersByTime(4000);
    expect(service.toasts()).toEqual([]);
  });

  it('conserva como máximo 4 avisos', () => {
    const service = TestBed.inject(ToastService);
    for (let i = 1; i <= 6; i++) service.info(`Aviso ${i}`);
    expect(service.toasts().map((t) => t.message)).toEqual([
      'Aviso 3',
      'Aviso 4',
      'Aviso 5',
      'Aviso 6',
    ]);
  });
});
