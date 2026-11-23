import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import {
  FormField,
  form,
  maxLength,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { toApiError } from '../../core/api/api-types';
import { AuthStore } from '../../core/auth/auth-store';
import { PosButton, PosDialog, PosInput, ToastService } from '../../shared/ui';

@Component({
  selector: 'pos-change-password-dialog',
  imports: [FormField, PosDialog, PosInput, PosButton],
  template: `
    <form novalidate (submit)="save(); $event.preventDefault()">
      <pos-dialog heading="Cambiar contraseña" description="Usa al menos 8 caracteres.">
        <div class="fields">
          <pos-input
            label="Contraseña actual"
            type="password"
            autocomplete="current-password"
            [formField]="passwordForm.currentPassword"
          />
          <pos-input
            label="Nueva contraseña"
            type="password"
            autocomplete="new-password"
            [formField]="passwordForm.newPassword"
          />
          <pos-input
            label="Confirmar nueva contraseña"
            type="password"
            autocomplete="new-password"
            [formField]="passwordForm.confirm"
          />
        </div>
        <ng-container dialogActions>
          <button posButton variant="secondary" type="button" (click)="ref.close()">
            Cancelar
          </button>
          <button posButton type="submit" icon="check" [loading]="saving()">Guardar</button>
        </ng-container>
      </pos-dialog>
    </form>
  `,
  styles: `
    form {
      display: contents;
    }
    .fields {
      display: grid;
      gap: var(--space-4);
    }
  `,
})
export class ChangePasswordDialog {
  protected readonly ref = inject(DialogRef);
  private readonly auth = inject(AuthStore);
  private readonly toast = inject(ToastService);

  protected readonly saving = signal(false);
  protected readonly model = signal({ currentPassword: '', newPassword: '', confirm: '' });
  protected readonly passwordForm = form(this.model, (s) => {
    required(s.currentPassword, { message: 'Escribe tu contraseña actual' });
    required(s.newPassword, { message: 'Escribe la nueva contraseña' });
    minLength(s.newPassword, 8, { message: 'Mínimo 8 caracteres' });
    maxLength(s.newPassword, 72, { message: 'Máximo 72 caracteres' });
    validate(s.confirm, ({ value, valueOf }) =>
      value() === valueOf(s.newPassword)
        ? undefined
        : { kind: 'mismatch', message: 'Las contraseñas no coinciden' },
    );
  });

  protected save(): void {
    void submit(this.passwordForm, async (f) => {
      this.saving.set(true);
      try {
        const { currentPassword, newPassword } = this.model();
        await this.auth.changePassword(currentPassword, newPassword);
        this.toast.success('Contraseña actualizada');
        this.ref.close();
        return undefined;
      } catch (error) {
        const apiError = toApiError(error);
        if (apiError.status === 400) {
          return [{ kind: 'server', message: apiError.message, fieldTree: f.currentPassword }];
        }
        this.toast.error(apiError.message);
        return undefined;
      } finally {
        this.saving.set(false);
      }
    });
  }
}
