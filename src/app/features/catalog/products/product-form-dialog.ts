import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FormField,
  disabled,
  form,
  maxLength,
  min,
  minLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { toApiError } from '../../../core/api/api-types';
import { serverFieldErrors } from '../../../core/api/server-errors';
import {
  PosButton,
  PosDialog,
  PosInput,
  PosMoneyInput,
  PosQtyInput,
  PosSelect,
  PosToggle,
  ToastService,
} from '../../../shared/ui';
import { formatMoney } from '../../../shared/utils/format';
import { UNITS, type Unit } from '../../../shared/utils/qty';
import { CatalogApi, type ProductInput } from '../catalog-api';
import { CatalogLookups } from '../catalog-lookups';
import { type Product, TAX_OPTIONS, type TaxRateBp, UNIT_OPTIONS } from '../catalog-models';

export interface ProductFormData {
  product?: Product;
}

@Component({
  selector: 'pos-product-form-dialog',
  imports: [
    FormField,
    PosDialog,
    PosInput,
    PosSelect,
    PosMoneyInput,
    PosQtyInput,
    PosToggle,
    PosButton,
  ],
  templateUrl: './product-form-dialog.html',
  styleUrl: './product-form-dialog.scss',
})
export class ProductFormDialog {
  protected readonly ref = inject<DialogRef<Product>>(DialogRef);
  private readonly data = inject<ProductFormData>(DIALOG_DATA);
  private readonly api = inject(CatalogApi);
  private readonly toast = inject(ToastService);
  protected readonly lookups = inject(CatalogLookups);

  protected readonly product = this.data.product;
  protected readonly isEdit = Boolean(this.product);
  protected readonly saving = signal(false);
  protected readonly unitOptions = UNIT_OPTIONS;
  protected readonly taxOptions = TAX_OPTIONS;
  protected readonly categoryOptions = computed(() => [
    { value: '', label: 'Sin categoría' },
    ...this.lookups.categoryOptions(this.product?.categoryId),
  ]);

  protected readonly model = signal({
    code: this.product?.code ?? '',
    barcode: this.product?.barcode ?? '',
    name: this.product?.name ?? '',
    categoryId: this.product?.categoryId ?? '',
    unit: (this.product?.unit ?? 'kg') as string,
    salePriceCents: this.product?.salePriceCents ?? 0,
    costCents: this.product?.costCents ?? 0,
    taxRateBp: String(this.product?.taxRateBp ?? 1600),
    minStock: this.product?.minStock ?? 0,
    initialStock: 0,
    active: this.product?.active ?? true,
  });

  protected readonly productForm = form(this.model, (s) => {
    required(s.code, { message: 'Escribe un código' });
    maxLength(s.code, 20, { message: 'Máximo 20 caracteres' });
    pattern(s.code, /^[A-Za-z0-9._-]+$/, { message: 'Solo letras, números, punto o guion' });
    maxLength(s.barcode, 64, { message: 'Máximo 64 caracteres' });
    pattern(s.barcode, /^[0-9A-Za-z-]*$/, { message: 'Solo números, letras o guion' });
    required(s.name, { message: 'Escribe el nombre' });
    minLength(s.name, 2, { message: 'Mínimo 2 caracteres' });
    maxLength(s.name, 120, { message: 'Máximo 120 caracteres' });
    required(s.unit, { message: 'Elige la unidad' });
    // La unidad no cambia después del alta: rompería el historial de cantidades.
    disabled(s.unit, { when: () => this.isEdit });
    min(s.salePriceCents, 1, { message: 'Escribe el precio de venta' });
  });

  protected readonly unit = computed(() => this.model().unit as Unit);
  protected readonly unitLabel = computed(() => UNITS[this.unit()].label);

  /** Margen sobre el precio (IVA incluido) con el costo capturado. */
  protected readonly margin = computed(() => {
    const { salePriceCents: price, costCents: cost } = this.model();
    if (price <= 0 || cost <= 0) return null;
    const profit = price - cost;
    return {
      percent: ((profit / price) * 100).toFixed(1),
      profit: formatMoney(profit),
      negative: profit < 0,
    };
  });

  constructor() {
    if (!this.isEdit) {
      this.api
        .nextCode()
        .then((code) => {
          if (!this.model().code) this.model.update((m) => ({ ...m, code }));
        })
        .catch(() => undefined);
    }
  }

  protected save(): void {
    void submit(this.productForm, async (f) => {
      this.saving.set(true);
      try {
        const m = this.model();
        const input: ProductInput = {
          code: m.code.trim().toUpperCase(),
          barcode: m.barcode.trim(),
          name: m.name.trim(),
          categoryId: m.categoryId || null,
          unit: m.unit as Unit,
          salePriceCents: m.salePriceCents,
          costCents: m.costCents,
          taxRateBp: Number(m.taxRateBp) as TaxRateBp,
          minStock: m.minStock,
        };
        let saved: Product;
        if (this.product) {
          const { unit: _unit, ...changes } = input;
          saved = await this.api.updateProduct(this.product.id, { ...changes, active: m.active });
        } else {
          saved = await this.api.createProduct({
            ...input,
            ...(input.barcode ? {} : { barcode: undefined }),
            initialStock: m.initialStock,
          });
        }
        this.toast.success(
          this.isEdit ? 'Producto actualizado' : `Producto "${saved.name}" creado`,
        );
        this.ref.close(saved);
        return undefined;
      } catch (error) {
        const apiError = toApiError(error);
        const errors = serverFieldErrors(apiError, {
          code: f.code,
          barcode: f.barcode,
          name: f.name,
          categoryId: f.categoryId,
          unit: f.unit,
          salePriceCents: f.salePriceCents,
          costCents: f.costCents,
          taxRateBp: f.taxRateBp,
          minStock: f.minStock,
          initialStock: f.initialStock,
        });
        if (!errors.length) this.toast.error(apiError.message);
        return errors;
      } finally {
        this.saving.set(false);
      }
    });
  }
}
