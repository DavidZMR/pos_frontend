import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { toApiError } from '../../../core/api/api-types';
import { serverFieldErrors } from '../../../core/api/server-errors';
import { PosButton, PosDialog, PosInput, ToastService } from '../../../shared/ui';
import { CatalogApi } from '../catalog-api';
import type { Category } from '../catalog-models';

export interface CategoryFormData {
  category?: Category;
}

@Component({
  selector: 'pos-category-form-dialog',
  imports: [FormField, PosDialog, PosInput, PosButton],
  template: `
    <form novalidate (submit)="save(); $event.preventDefault()">
      <pos-dialog
        [heading]="isEdit ? 'Editar categoría' : 'Nueva categoría'"
        description="Agrupa productos para encontrarlos rápido en caja y en reportes."
      >
        <pos-input
          label="Nombre"
          placeholder="p. ej. Mariscos frescos"
          [formField]="categoryForm.name"
        />
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
  `,
})
export class CategoryFormDialog {
  protected readonly ref = inject<DialogRef<Category>>(DialogRef);
  private readonly data = inject<CategoryFormData>(DIALOG_DATA);
  private readonly api = inject(CatalogApi);
  private readonly toast = inject(ToastService);

  protected readonly isEdit = Boolean(this.data.category);
  protected readonly saving = signal(false);
  protected readonly model = signal({ name: this.data.category?.name ?? '' });
  protected readonly categoryForm = form(this.model, (s) => {
    required(s.name, { message: 'Escribe el nombre' });
    minLength(s.name, 2, { message: 'Mínimo 2 caracteres' });
    maxLength(s.name, 60, { message: 'Máximo 60 caracteres' });
  });

  protected save(): void {
    void submit(this.categoryForm, async (f) => {
      this.saving.set(true);
      try {
        const name = this.model().name.trim();
        const saved = this.data.category
          ? await this.api.updateCategory(this.data.category.id, { name })
          : await this.api.createCategory(name);
        this.toast.success(
          this.isEdit ? 'Categoría actualizada' : `Categoría "${saved.name}" creada`,
        );
        this.ref.close(saved);
        return undefined;
      } catch (error) {
        const apiError = toApiError(error);
        const errors = serverFieldErrors(apiError, { name: f.name }, 'name');
        if (!errors.length) this.toast.error(apiError.message);
        return errors;
      } finally {
        this.saving.set(false);
      }
    });
  }
}
