import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { PosButton } from '../button/button';
import { PosDialog } from './dialog';

export interface ConfirmOptions {
  heading: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'brand' | 'danger';
}

@Component({
  selector: 'pos-confirm-dialog',
  imports: [PosDialog, PosButton],
  template: `
    <pos-dialog [heading]="data.heading" [closable]="false">
      <p class="message">{{ data.message }}</p>
      <ng-container dialogActions>
        <button posButton variant="secondary" type="button" (click)="ref.close(false)">
          {{ data.cancelText ?? 'Cancelar' }}
        </button>
        <button
          posButton
          type="button"
          [variant]="data.tone === 'danger' ? 'danger' : 'primary'"
          (click)="ref.close(true)"
        >
          {{ data.confirmText ?? 'Confirmar' }}
        </button>
      </ng-container>
    </pos-dialog>
  `,
  styles: `
    .message {
      color: var(--ink-muted);
    }
  `,
})
export class PosConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}
