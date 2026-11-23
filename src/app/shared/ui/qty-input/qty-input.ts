import {
  Component,
  type ElementRef,
  computed,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { UNITS, type Unit, parseQtyToBase, qtyBaseToDecimalString } from '../../utils/qty';
import { PosFieldBase } from '../field/field-state';

/**
 * Captura de cantidad según la unidad: pz enteras; kg/l con hasta 3 decimales.
 * El valor es la **unidad base entera** (piezas, gramos, mililitros).
 *   <pos-qty-input label="Cantidad" [unit]="'kg'" [formField]="form.qtyBase" />  // "1.25" → 1250
 */
@Component({
  selector: 'pos-qty-input',
  template: `
    <div class="field">
      @if (label()) {
        <label class="label" [for]="controlId">
          {{ label() }}
          @if (required()) {
            <span class="req" aria-hidden="true">*</span>
          }
        </label>
      }
      <div
        class="control"
        [class.control--invalid]="showErrors() || parseError()"
        [class.control--disabled]="disabled()"
      >
        <input
          #native
          class="native num"
          autocomplete="off"
          [attr.inputmode]="decimals() > 0 ? 'decimal' : 'numeric'"
          [id]="controlId"
          [value]="text()"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          [attr.name]="name() || null"
          [attr.placeholder]="placeholder()"
          [attr.aria-invalid]="showErrors() || parseError()"
          [attr.aria-describedby]="describedBy()"
          (focus)="onFocus()"
          (input)="onInput(native.value)"
          (blur)="onBlur()"
        />
        <span class="affix unit">{{ unitLabel() }}</span>
      </div>
      @if (parseError()) {
        <span class="error" [id]="errorId">{{ parseMessage() }}</span>
      } @else if (showErrors()) {
        <span class="error" [id]="errorId">{{ firstError() }}</span>
      } @else if (hint()) {
        <span class="hint" [id]="hintId">{{ hint() }}</span>
      }
    </div>
  `,
  styleUrl: './qty-input.scss',
})
export class PosQtyInput extends PosFieldBase implements FormValueControl<number> {
  readonly value = model(0);
  readonly unit = input.required<Unit>();

  protected readonly decimals = computed(() => UNITS[this.unit()].decimals);
  protected readonly unitLabel = computed(() => UNITS[this.unit()].label);
  protected readonly placeholder = computed(() => (this.decimals() > 0 ? '0.000' : '0'));
  protected readonly parseMessage = computed(() =>
    this.decimals() > 0
      ? `Escribe una cantidad válida con hasta ${this.decimals()} decimales`
      : 'Escribe una cantidad entera de piezas',
  );

  private readonly focused = signal(false);
  private readonly draft = signal('');
  protected readonly parseError = signal(false);

  protected readonly text = computed(() =>
    this.focused() ? this.draft() : qtyBaseToDecimalString(this.value(), this.unit()),
  );

  private readonly native = viewChild.required<ElementRef<HTMLInputElement>>('native');

  protected onFocus(): void {
    this.draft.set(this.value() === 0 ? '' : qtyBaseToDecimalString(this.value(), this.unit()));
    this.focused.set(true);
    queueMicrotask(() => this.native().nativeElement.select());
  }

  protected onInput(raw: string): void {
    this.draft.set(raw);
    if (raw.trim() === '') {
      this.parseError.set(false);
      this.value.set(0);
      return;
    }
    try {
      const qty = parseQtyToBase(raw, this.unit());
      this.parseError.set(qty < 0);
      if (qty >= 0) this.value.set(qty);
    } catch {
      this.parseError.set(true);
    }
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.parseError.set(false);
    this.touch.emit();
  }

  focus(options?: FocusOptions): void {
    this.native().nativeElement.focus(options);
  }
}
