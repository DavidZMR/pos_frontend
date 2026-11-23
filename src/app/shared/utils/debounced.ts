import { DestroyRef, type Signal, effect, inject, signal, untracked } from '@angular/core';

/**
 * Signal que sigue a `source` con un retraso (para buscadores que consultan al API).
 * Debe crearse en un contexto de inyección (campo de componente o constructor).
 */
export function debounced<T>(source: Signal<T>, ms = 300): Signal<T> {
  const output = signal<T>(untracked(source));
  let timer: ReturnType<typeof setTimeout> | undefined;

  effect(() => {
    const value = source();
    clearTimeout(timer);
    timer = setTimeout(() => output.set(value), ms);
  });
  inject(DestroyRef).onDestroy(() => clearTimeout(timer));

  return output.asReadonly();
}
