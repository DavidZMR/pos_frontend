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
import { centsToDecimalString, parseMoneyToCents } from '../../utils/money';
import { PosFieldBase } from '../field/field-state';

const display = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Captura de dinero: el usuario escribe "1,234.5" y el valor es **centavos enteros** (123450).
 * Mientras tiene foco no se reformatea (el cursor no salta); al salir se muestra "1,234.50".
 *   <pos-money-input label="Precio por kg" [formField]="form.salePriceCents" />
 */
@Component({
  selector: 'pos-money-input',
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
        <span class="affix">$</span>
        <input
          #native
          class="native num"
          inputmode="decimal"
          autocomplete="off"
          [id]="controlId"
          [value]="text()"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          [attr.name]="name() || null"
          [attr.placeholder]="placeholder() || null"
          [attr.aria-invalid]="showErrors() || parseError()"
          [attr.aria-describedby]="describedBy()"
          (focus)="onFocus()"
          (input)="onInput(native.value)"
          (blur)="onBlur()"
        />
        @if (suffix()) {
          <span class="affix">{{ suffix() }}</span>
        }
      </div>
      @if (parseError()) {
        <span class="error" [id]="errorId">Escribe un monto válido, p. ej. 125.50</span>
      } @else if (showErrors()) {
        <span class="error" [id]="errorId">{{ firstError() }}</span>
      } @else if (hint()) {
        <span class="hint" [id]="hintId">{{ hint() }}</span>
      }
    </div>
  `,
  styleUrl: './money-input.scss',
})
export class PosMoneyInput extends PosFieldBase implements FormValueControl<number> {
  readonly value = model(0);
  readonly placeholder = input('0.00');
  /** Texto después del monto, p. ej. "/ kg". */
  readonly suffix = input('');

  private readonly focused = signal(false);
  private readonly draft = signal('');
  protected readonly parseError = signal(false);

  protected readonly text = computed(() =>
    this.focused() ? this.draft() : display.format(this.value() / 100),
  );

  private readonly native = viewChild.required<ElementRef<HTMLInputElement>>('native');

  protected onFocus(): void {
    const draft = this.value() === 0 ? '' : centsToDecimalString(this.value());
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
    if (raw.trim() === '') {
      this.parseError.set(false);
      this.value.set(0);
      return;
    }
    try {
      const cents = parseMoneyToCents(raw);
      this.parseError.set(cents < 0);
      if (cents >= 0) this.value.set(cents);
    } catch {
      this.parseError.set(true);
    }
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.parseError.set(false); // al salir se muestra el último valor válido
    this.touch.emit();
  }

  focus(options?: FocusOptions): void {
    this.native().nativeElement.focus(options);
  }
}
