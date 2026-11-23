import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import {
  FormField,
  email,
  form,
  maxLength,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { toApiError } from '../../../core/api/api-types';
import { serverFieldErrors } from '../../../core/api/server-errors';
import { PosButton, PosDialog, PosInput, PosTextarea, ToastService } from '../../../shared/ui';
import { CatalogApi } from '../catalog-api';
import type { Supplier } from '../catalog-models';

export interface SupplierFormData {
  supplier?: Supplier;
}

@Component({
  selector: 'pos-supplier-form-dialog',
  imports: [FormField, PosDialog, PosInput, PosTextarea, PosButton],
  template: `
    <form novalidate (submit)="save(); $event.preventDefault()">
      <pos-dialog
        [heading]="isEdit ? 'Editar proveedor' : 'Nuevo proveedor'"
        description="Quién te surte la mercancía. Se usa en las entradas y en el reporte de compras."
      >
        <div class="grid">
          <pos-input class="span-2" label="Nombre" [formField]="supplierForm.name" />
          <pos-input label="Contacto" icon="user" [formField]="supplierForm.contactName" />
          <pos-input label="Teléfono" type="tel" [formField]="supplierForm.phone" />
          <pos-input class="span-2" label="Correo" type="email" [formField]="supplierForm.email" />
          <pos-textarea
            class="span-2"
            label="Notas"
            placeholder="Días de entrega, condiciones, etc."
            [formField]="supplierForm.notes"
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
export class SupplierFormDialog {
  protected readonly ref = inject<DialogRef<Supplier>>(DialogRef);
  private readonly data = inject<SupplierFormData>(DIALOG_DATA);
  private readonly api = inject(CatalogApi);
  private readonly toast = inject(ToastService);

  protected readonly isEdit = Boolean(this.data.supplier);
  protected readonly saving = signal(false);
  protected readonly model = signal({
    name: this.data.supplier?.name ?? '',
    contactName: this.data.supplier?.contactName ?? '',
    phone: this.data.supplier?.phone ?? '',
    email: this.data.supplier?.email ?? '',
    notes: this.data.supplier?.notes ?? '',
  });
  protected readonly supplierForm = form(this.model, (s) => {
    required(s.name, { message: 'Escribe el nombre' });
    minLength(s.name, 2, { message: 'Mínimo 2 caracteres' });
    maxLength(s.name, 120, { message: 'Máximo 120 caracteres' });
    email(s.email, { message: 'Correo inválido' });
    maxLength(s.notes, 500, { message: 'Máximo 500 caracteres' });
  });

  protected save(): void {
    void submit(this.supplierForm, async (f) => {
      this.saving.set(true);
      try {
        const input = { ...this.model(), name: this.model().name.trim() };
        const saved = this.data.supplier
          ? await this.api.updateSupplier(this.data.supplier.id, input)
          : await this.api.createSupplier(input);
        this.toast.success(
          this.isEdit ? 'Proveedor actualizado' : `Proveedor "${saved.name}" creado`,
        );
        this.ref.close(saved);
        return undefined;
      } catch (error) {
        const apiError = toApiError(error);
        const errors = serverFieldErrors(
          apiError,
          { name: f.name, email: f.email, phone: f.phone, contactName: f.contactName },
          apiError.status === 409 ? 'name' : undefined,
        );
        if (!errors.length) this.toast.error(apiError.message);
        return errors;
      } finally {
        this.saving.set(false);
      }
    });
  }
}
