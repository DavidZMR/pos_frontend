import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type ConfirmOptions, PosConfirmDialog } from './confirm-dialog';
import { DialogService } from './dialog-service';

/**
 * Confirmación modal que reemplaza a window.confirm / SweetAlert:
 *   if (await confirm.ask({ heading: '¿Desactivar?', message: '…', tone: 'danger' })) { … }
 */
@Service()
export class ConfirmService {
  private readonly dialogs = inject(DialogService);

  async ask(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialogs.open<boolean, ConfirmOptions>(PosConfirmDialog, {
      data: options,
      size: 'sm',
    });
    return (await firstValueFrom(ref.closed)) === true;
  }
}
