import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import type { ComponentType } from '@angular/cdk/portal';
import { Service, inject } from '@angular/core';

export type DialogSize = 'sm' | 'md' | 'lg';

const WIDTHS: Record<DialogSize, string> = { sm: '26rem', md: '34rem', lg: '48rem' };

export interface OpenDialogOptions<D> {
  data?: D;
  size?: DialogSize;
  /** Si es false, Escape y clic fuera no cierran (útil con cambios sin guardar). */
  dismissible?: boolean;
}

/** Abre componentes en diálogo con el estilo del sistema (backdrop, ancho, foco atrapado). */
@Service()
export class DialogService {
  private readonly dialog = inject(Dialog);

  open<R, D = unknown, C = unknown>(
    component: ComponentType<C>,
    { data, size = 'md', dismissible = true }: OpenDialogOptions<D> = {},
  ): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(component, {
      data,
      width: WIDTHS[size],
      maxWidth: 'calc(100vw - 2rem)',
      panelClass: 'pos-dialog-panel',
      backdropClass: 'pos-backdrop',
      disableClose: !dismissible,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
  }
}
