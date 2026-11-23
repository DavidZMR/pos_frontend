import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FormField,
  form,
  hidden,
  maxLength,
  minLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { toApiError } from '../../core/api/api-types';
import { serverFieldErrors } from '../../core/api/server-errors';
import { ROLE_LABELS, type Role, type User } from '../../core/auth/auth-models';
import { AuthStore } from '../../core/auth/auth-store';
import { BusinessContext } from '../../core/business/business-context';
import {
  PosButton,
  PosDialog,
  PosInput,
  PosSelect,
  PosToggle,
  type SelectOption,
  ToastService,
} from '../../shared/ui';
import { type CreateUserInput, UserApi, type UpdateUserInput } from './user-api';

export interface UserFormData {
  user?: User;
}

@Component({
  selector: 'pos-user-form-dialog',
  imports: [FormField, PosDialog, PosInput, PosSelect, PosToggle, PosButton],
  template: `
    <form novalidate (submit)="save(); $event.preventDefault()">
      <pos-dialog
        [heading]="isEdit ? 'Editar usuario' : 'Nuevo usuario'"
        [description]="description"
      >
        <div class="grid">
          <pos-input
            class="span-2"
            label="Nombre completo"
            icon="user"
            [formField]="userForm.name"
          />
          <pos-input
            label="Usuario"
            hint="Minúsculas, números, punto o guion"
            autocomplete="off"
            [formField]="userForm.username"
          />
          <pos-input
            label="Contraseña"
            type="password"
            autocomplete="new-password"
            [hint]="isEdit ? 'Déjala vacía para no cambiarla' : 'Mínimo 8 caracteres'"
            [formField]="userForm.password"
          />
          @if (!userForm.role().hidden()) {
            <pos-select
              label="Rol"
              placeholder="Selecciona…"
              [options]="roleOptions"
              [formField]="userForm.role"
            />
          }
          @if (!userForm.businessId().hidden()) {
            <pos-select
              label="Negocio"
              placeholder="Selecciona…"
              [options]="businessOptions()"
              [formField]="userForm.businessId"
            />
          }
          @if (isEdit) {
            <pos-toggle
              class="span-2"
              label="Puede iniciar sesión"
              [description]="
                isSelf
                  ? 'No puedes desactivar tu propio usuario.'
                  : 'Desactívalo en lugar de borrarlo.'
              "
              [formField]="userForm.active"
            />
          }
        </div>
        <ng-container dialogActions>
          <button posButton variant="secondary" type="button" (click)="ref.close()">
            Cancelar
          </button>
          <button posButton type="submit" icon="check" [loading]="saving()">
            {{ isEdit ? 'Guardar cambios' : 'Crear usuario' }}
          </button>
        </ng-container>
      </pos-dialog>
    </form>
  `,
  styles: `
    form {
      display: contents;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4);
    }
    .span-2 {
      grid-column: 1 / -1;
    }
    @media (max-width: 36rem) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class UserFormDialog {
  protected readonly ref = inject<DialogRef<User>>(DialogRef);
  private readonly data = inject<UserFormData>(DIALOG_DATA);
  private readonly api = inject(UserApi);
  private readonly auth = inject(AuthStore);
  private readonly context = inject(BusinessContext);
  private readonly toast = inject(ToastService);

  protected readonly isEdit = Boolean(this.data.user);
  protected readonly isSelf = this.data.user?.id === this.auth.user()?.id;
  private readonly isSuperadmin = this.auth.isSuperadmin();
  protected readonly saving = signal(false);

  protected readonly description = this.isSuperadmin
    ? 'Los empleados solo usan el punto de venta; los administradores gestionan su negocio.'
    : 'Los empleados solo pueden usar el punto de venta de tu negocio.';

  protected readonly roleOptions: SelectOption[] = (
    ['superadmin', 'admin', 'employee'] as const
  ).map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
    disabled: this.isSelf && role !== this.data.user?.role,
  }));

  protected readonly businessOptions = computed<SelectOption[]>(() =>
    this.context
      .options()
      .map((b) => ({ value: b.id, label: b.active ? b.name : `${b.name} (inactivo)` })),
  );

  protected readonly model = signal({
    name: this.data.user?.name ?? '',
    username: this.data.user?.username ?? '',
    password: '',
    role: (this.data.user?.role ?? (this.isSuperadmin ? '' : 'employee')) as Role | '',
    businessId: this.data.user?.businessId ?? this.context.current()?.id ?? '',
    active: this.data.user?.active ?? true,
  });

  protected readonly userForm = form(this.model, (s) => {
    required(s.name, { message: 'Escribe el nombre' });
    minLength(s.name, 2, { message: 'Mínimo 2 caracteres' });
    maxLength(s.name, 120, { message: 'Máximo 120 caracteres' });

    required(s.username, { message: 'Escribe el usuario' });
    minLength(s.username, 3, { message: 'Mínimo 3 caracteres' });
    maxLength(s.username, 40, { message: 'Máximo 40 caracteres' });
    pattern(s.username, /^[a-zA-Z0-9._-]+$/, { message: 'Sin espacios ni acentos' });

    if (!this.isEdit) required(s.password, { message: 'Escribe una contraseña' });
    validate(s.password, ({ value }) => {
      const length = value().length;
      if (length > 0 && length < 8) return { kind: 'minLength', message: 'Mínimo 8 caracteres' };
      if (length > 72) return { kind: 'maxLength', message: 'Máximo 72 caracteres' };
      return undefined;
    });

    // El admin solo crea empleados: el rol no se muestra.
    hidden(s.role, { when: () => !this.isSuperadmin });
    required(s.role, { message: 'Elige un rol', when: () => this.isSuperadmin });

    // El negocio solo lo elige el superadmin, y no aplica a otros superadmin.
    hidden(s.businessId, {
      when: ({ valueOf }) => !this.isSuperadmin || valueOf(s.role) === 'superadmin',
    });
    required(s.businessId, {
      message: 'Elige el negocio',
      when: ({ valueOf }) => this.isSuperadmin && valueOf(s.role) !== 'superadmin',
    });
  });

  protected save(): void {
    void submit(this.userForm, async (f) => {
      this.saving.set(true);
      try {
        const saved = this.data.user
          ? await this.api.update(this.data.user.id, this.updatePayload())
          : await this.api.create(this.createPayload());
        this.toast.success(
          this.isEdit ? 'Usuario actualizado' : `Usuario "${saved.username}" creado`,
        );
        this.ref.close(saved);
        return undefined;
      } catch (error) {
        const apiError = toApiError(error);
        const fieldErrors = serverFieldErrors(
          apiError,
          {
            name: f.name,
            username: f.username,
            password: f.password,
            role: f.role,
            businessId: f.businessId,
          },
          apiError.status === 409 ? 'username' : undefined,
        );
        if (fieldErrors.length === 0) this.toast.error(apiError.message);
        return fieldErrors;
      } finally {
        this.saving.set(false);
      }
    });
  }

  private createPayload(): CreateUserInput {
    const m = this.model();
    const role = (this.isSuperadmin ? m.role : 'employee') as Role;
    return {
      name: m.name.trim(),
      username: m.username.trim().toLowerCase(),
      password: m.password,
      role,
      ...(this.isSuperadmin && role !== 'superadmin' && { businessId: m.businessId }),
    };
  }

  private updatePayload(): UpdateUserInput {
    const m = this.model();
    const payload: UpdateUserInput = {
      name: m.name.trim(),
      username: m.username.trim().toLowerCase(),
    };
    if (m.password) payload.password = m.password;
    if (!this.isSelf) payload.active = m.active;
    if (this.isSuperadmin && !this.isSelf) {
      payload.role = m.role as Role;
      if (m.role !== 'superadmin') payload.businessId = m.businessId;
    }
    return payload;
  }
}
