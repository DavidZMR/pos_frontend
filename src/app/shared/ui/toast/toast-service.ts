import { Service, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

const DURATION: Record<ToastTone, number> = {
  success: 3500,
  info: 4000,
  warning: 6000,
  error: 7000,
};

/** Avisos breves en la esquina. Se muestran con <pos-toast-outlet /> (ya incluido en App). */
@Service()
export class ToastService {
  private nextId = 0;
  private readonly items = signal<readonly Toast[]>([]);
  readonly toasts = this.items.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  info(message: string): void {
    this.show('info', message);
  }

  warning(message: string): void {
    this.show('warning', message);
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((toast) => toast.id !== id));
  }

  private show(tone: ToastTone, message: string): void {
    const id = ++this.nextId;
    this.items.update((list) => [...list.slice(-3), { id, tone, message }]);
    setTimeout(() => this.dismiss(id), DURATION[tone]);
  }
}
