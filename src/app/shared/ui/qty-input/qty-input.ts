import {
  Component,
  type ElementRef,
  computed,
  effect,
  input,
  model,
  signal,
  untracked,
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
  protected readonly parseMessage = computed(() => {
    if (this.commaTyped()) return 'Usa punto para los decimales, p. ej. 1.5';
    return this.decimals() > 0
      ? `Escribe una cantidad válida con hasta ${this.decimals()} decimales`
      : 'Escribe una cantidad entera de piezas';
  });

  private readonly focused = signal(false);
  private readonly draft = signal('');
  protected readonly parseError = signal(false);
  private readonly commaTyped = signal(false);
  /** Lo escrito no es una cantidad válida (el valor sigue siendo el último válido). */
  readonly unparsable = this.parseError.asReadonly();

  protected readonly text = computed(() =>
    this.focused() ? this.draft() : qtyBaseToDecimalString(this.value(), this.unit()),
  );

  private readonly native = viewChild.required<ElementRef<HTMLInputElement>>('native');
  /** Último valor que salió de lo tecleado; cualquier otro cambio vino de fuera. */
  private typed: number | null = null;

  constructor() {
    super();
    // Si el valor cambia desde fuera con el campo enfocado (p. ej. la báscula), se muestra y queda
    // seleccionado: el cajero puede escribir encima para corregirlo.
    effect(() => {
      const value = this.value();
      if (!untracked(this.focused) || value === this.typed) return;
      const draft = value === 0 ? '' : qtyBaseToDecimalString(value, untracked(this.unit));
      this.typed = value;
      this.draft.set(draft);
      const native = this.native().nativeElement;
      native.value = draft;
      native.select();
    });
  }

  protected onFocus(): void {
    const draft = this.value() === 0 ? '' : qtyBaseToDecimalString(this.value(), this.unit());
    this.typed = this.value();
    this.draft.set(draft);
    this.focused.set(true);
    // El borrador se escribe YA en el DOM y se selecciona: si se esperara al render, el render
    // reemplazaría el texto, se perdería la selección y lo tecleado se agregaría al final.
    const native = this.native().nativeElement;
    native.value = draft;
    native.select();
  }

  protected onInput(raw: string): void {
    this.draft.set(raw);
    this.commaTyped.set(raw.includes(','));
    if (raw.trim() === '') {
      this.parseError.set(false);
      this.typed = 0;
      this.value.set(0);
      return;
    }
    try {
      const qty = parseQtyToBase(raw, this.unit());
      this.parseError.set(qty < 0);
      if (qty >= 0) {
        this.typed = qty;
        this.value.set(qty);
      }
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
