import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { toApiError } from '../../core/api/api-types';
import { serverFieldErrors } from '../../core/api/server-errors';
import type { Business } from '../../core/auth/auth-models';
import {
  PosButton,
  PosDialog,
  PosInput,
  PosSelect,
  PosToggle,
  ToastService,
} from '../../shared/ui';
import { BusinessApi, MX_TIMEZONES } from './business-api';

export interface BusinessFormData {
  business?: Business;
}

@Component({
  selector: 'pos-business-form-dialog',
  imports: [FormField, PosDialog, PosInput, PosSelect, PosToggle, PosButton],
  template: `
    <form novalidate (submit)="save(); $event.preventDefault()">
      <pos-dialog
        [heading]="isEdit ? 'Editar negocio' : 'Nuevo negocio'"
        description="Los datos fiscales y de contacto aparecen en tickets y reportes."
      >
        <div class="grid">
          <pos-input class="span-2" label="Nombre comercial" [formField]="businessForm.name" />
          <pos-input class="span-2" label="Razón social" [formField]="businessForm.legalName" />
          <pos-input label="RFC" [formField]="businessForm.taxId" />
          <pos-input label="Teléfono" type="tel" [formField]="businessForm.phone" />
          <pos-input class="span-2" label="Dirección" [formField]="businessForm.address" />
          <pos-select
            class="span-2"
            label="Zona horaria"
            hint="Define dónde empieza y termina cada día en cortes y reportes."
            [options]="timezones"
            [formField]="businessForm.timezone"
          />
          <pos-toggle
            class="span-2"
            label="Permitir vender sin existencia"
            description="Útil cuando el inventario por peso no es exacto."
            [formField]="businessForm.allowNegativeStock"
          />
        </div>
        <ng-container dialogActions>
          <button posButton variant="secondary" type="button" (click)="ref.close()">
            Cancelar
          </button>
          <button posButton type="submit" icon="check" [loading]="saving()">
            {{ isEdit ? 'Guardar cambios' : 'Crear negocio' }}
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
export class BusinessFormDialog {
  protected readonly ref = inject<DialogRef<Business>>(DialogRef);
  private readonly data = inject<BusinessFormData>(DIALOG_DATA);
  private readonly api = inject(BusinessApi);
  private readonly toast = inject(ToastService);

  protected readonly isEdit = Boolean(this.data.business);
  protected readonly timezones = [...MX_TIMEZONES];
  protected readonly saving = signal(false);

  protected readonly model = signal({
    name: this.data.business?.name ?? '',
    legalName: this.data.business?.legalName ?? '',
    taxId: this.data.business?.taxId ?? '',
    phone: this.data.business?.phone ?? '',
    address: this.data.business?.address ?? '',
    timezone: this.data.business?.timezone ?? 'America/Mexico_City',
    allowNegativeStock: this.data.business?.settings.allowNegativeStock ?? true,
  });

  protected readonly businessForm = form(this.model, (s) => {
    required(s.name, { message: 'Escribe el nombre del negocio' });
    minLength(s.name, 2, { message: 'Mínimo 2 caracteres' });
    maxLength(s.name, 120, { message: 'Máximo 120 caracteres' });
    maxLength(s.legalName, 160, { message: 'Máximo 160 caracteres' });
    maxLength(s.taxId, 20, { message: 'Máximo 20 caracteres' });
    maxLength(s.phone, 30, { message: 'Máximo 30 caracteres' });
    maxLength(s.address, 250, { message: 'Máximo 250 caracteres' });
    required(s.timezone, { message: 'Elige la zona horaria' });
  });

  protected save(): void {
    void submit(this.businessForm, async (f) => {
      this.saving.set(true);
      const { allowNegativeStock, ...fields } = this.model();
      const input = { ...fields, name: fields.name.trim(), settings: { allowNegativeStock } };
      try {
        const saved = this.data.business
          ? await this.api.update(this.data.business.id, input)
          : await this.api.create(input);
        this.toast.success(this.isEdit ? 'Negocio actualizado' : `Negocio "${saved.name}" creado`);
        this.ref.close(saved);
        return undefined;
      } catch (error) {
        const apiError = toApiError(error);
        const fieldErrors = serverFieldErrors(apiError, {
          name: f.name,
          legalName: f.legalName,
          taxId: f.taxId,
          phone: f.phone,
          address: f.address,
          timezone: f.timezone,
        });
        if (fieldErrors.length === 0) this.toast.error(apiError.message);
        return fieldErrors;
      } finally {
        this.saving.set(false);
      }
    });
  }
}
