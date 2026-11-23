import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, submit, validate } from '@angular/forms/signals';
import { toApiError } from '../../../core/api/api-types';
import { serverFieldErrors } from '../../../core/api/server-errors';
import {
  PosButton,
  PosDialog,
  PosQtyInput,
  PosSelect,
  PosTextarea,
  ToastService,
} from '../../../shared/ui';
import { formatQty } from '../../../shared/utils/format';
import type { Product } from '../../catalog/catalog-models';
import { type AdjustmentInput, InventoryApi } from '../inventory-api';
import { type AdjustmentReason, REASON_LABEL } from '../inventory-models';

type Mode = AdjustmentInput['mode'];

const MODES: { value: Mode; label: string; help: string; reason: AdjustmentReason }[] = [
  {
    value: 'remove',
    label: 'Merma / salida',
    help: 'Producto dañado, caducado o regalado',
    reason: 'merma',
  },
  { value: 'set', label: 'Conteo físico', help: 'Captura cuánto hay realmente', reason: 'conteo' },
  {
    value: 'add',
    label: 'Entrada / sobrante',
    help: 'Aparece producto sin compra',
    reason: 'otro',
  },
];

@Component({
  selector: 'pos-adjustment-dialog',
  imports: [FormField, PosDialog, PosQtyInput, PosSelect, PosTextarea, PosButton],
  templateUrl: './adjustment-dialog.html',
  styleUrl: './adjustment-dialog.scss',
})
export class AdjustmentDialog {
  protected readonly ref = inject<DialogRef<Product>>(DialogRef);
  protected readonly product = inject<Product>(DIALOG_DATA);
  private readonly api = inject(InventoryApi);
  private readonly toast = inject(ToastService);

  protected readonly modes = MODES;
  protected readonly reasonOptions = (Object.keys(REASON_LABEL) as AdjustmentReason[]).map((r) => ({
    value: r,
    label: REASON_LABEL[r],
  }));
  protected readonly saving = signal(false);
  protected readonly current = formatQty(this.product.stock, this.product.unit);

  protected readonly model = signal({
    mode: 'remove' as string,
    qtyBase: 0,
    reason: 'merma' as string,
    note: '',
  });

  protected readonly adjustForm = form(this.model, (s) => {
    validate(s.qtyBase, ({ value, valueOf }) => {
      const mode = valueOf(s.mode);
      if (mode !== 'set' && value() <= 0) return { kind: 'min', message: 'Escribe la cantidad' };
      if (mode === 'set' && value() === this.product.stock) {
        return { kind: 'same', message: 'Es igual a la existencia actual' };
      }
      return undefined;
    });
    maxLength(s.note, 300, { message: 'Máximo 300 caracteres' });
  });

  protected readonly qtyLabel = computed(() =>
    this.model().mode === 'set' ? 'Existencia contada' : 'Cantidad',
  );

  /** Existencia resultante para la vista previa. */
  protected readonly preview = computed(() => {
    const { mode, qtyBase } = this.model();
    const after =
      mode === 'set'
        ? qtyBase
        : mode === 'add'
          ? this.product.stock + qtyBase
          : this.product.stock - qtyBase;
    return {
      after: formatQty(after, this.product.unit),
      delta: after - this.product.stock,
      deltaText: formatQty(Math.abs(after - this.product.stock), this.product.unit),
      negative: after < 0,
    };
  });

  protected selectMode(mode: Mode): void {
    const reason = MODES.find((m) => m.value === mode)?.reason ?? 'otro';
    this.model.update((m) => ({
      ...m,
      mode,
      reason,
      qtyBase: mode === 'set' ? this.product.stock : 0,
    }));
  }

  protected save(): void {
    void submit(this.adjustForm, async (f) => {
      this.saving.set(true);
      try {
        const m = this.model();
        const { product } = await this.api.adjust({
          productId: this.product.id,
          mode: m.mode as Mode,
          qtyBase: m.qtyBase,
          reason: m.reason as AdjustmentReason,
          note: m.note.trim(),
        });
        this.toast.success(
          `Existencia de "${product.name}": ${formatQty(product.stock, product.unit)}`,
        );
        this.ref.close(product);
        return undefined;
      } catch (error) {
        const apiError = toApiError(error);
        const errors = serverFieldErrors(apiError, { qtyBase: f.qtyBase, note: f.note });
        if (!errors.length) this.toast.error(apiError.message);
        return errors;
      } finally {
        this.saving.set(false);
      }
    });
  }
}
